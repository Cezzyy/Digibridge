import { attempts, profiles, respondents, schoolLinks } from '@digibridge/db'
import { linkExpiresAt, linkStatus } from '@digibridge/shared'
import type { RouteHandler } from '@hono/zod-openapi'
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  ne,
  sql,
  type SQL,
} from 'drizzle-orm'
import type { Db } from '../config/db'
import type { AuthEnv } from '../env'
import { newLinkCode } from '../lib/link-code'
import { ApiError } from '../middleware'
import type {
  closeLinkRoute,
  createLinkRoute,
  listLinksRoute,
  overviewRoute,
} from '../routes/admin'

/** School links with their creator's name and response count, newest first. */
async function selectLinks(db: Db, where?: SQL) {
  const rows = await db
    .select({
      ...getTableColumns(schoolLinks),
      creatorName: profiles.fullName,
      creatorEmail: profiles.email,
      responses: db.$count(
        attempts,
        and(eq(attempts.schoolLinkId, schoolLinks.id), ne(attempts.status, 'voided')),
      ),
    })
    .from(schoolLinks)
    .leftJoin(profiles, eq(profiles.id, schoolLinks.createdBy))
    .where(where)
    .orderBy(desc(schoolLinks.createdAt))

  const now = new Date()
  return rows.map(({ creatorName, creatorEmail, createdBy: _createdBy, ...link }) => ({
    ...link,
    expiresAt: link.expiresAt.toISOString(),
    closedAt: link.closedAt?.toISOString() ?? null,
    createdAt: link.createdAt.toISOString(),
    createdBy: creatorName ?? creatorEmail,
    status: linkStatus(link, now),
  }))
}

export const getOverview: RouteHandler<typeof overviewRoute, AuthEnv> = async (c) => {
  const db = c.var.db
  const [byMode, [attemptCounts], links] = await Promise.all([
    db
      .select({ mode: respondents.mode, count: count() })
      .from(respondents)
      .groupBy(respondents.mode),
    db
      .select({
        inProgress: count(sql`case when ${attempts.status} = 'in_progress' then 1 end`),
        finished: count(
          sql`case when ${inArray(attempts.status, ['submitted', 'expired'])} then 1 end`,
        ),
      })
      .from(attempts),
    selectLinks(db),
  ])

  const online = byMode.find((row) => row.mode === 'online')?.count ?? 0
  const school = byMode.find((row) => row.mode === 'school')?.count ?? 0
  return c.json(
    {
      respondents: { total: online + school, online, school },
      attempts: {
        inProgress: attemptCounts?.inProgress ?? 0,
        finished: attemptCounts?.finished ?? 0,
      },
      links: { open: links.filter((link) => link.status === 'open').length, total: links.length },
    },
    200,
  )
}

export const listLinks: RouteHandler<typeof listLinksRoute, AuthEnv> = async (c) =>
  c.json(await selectLinks(c.var.db), 200)

/** Draws again if a new code is already taken; with ~10^14 codes, one retry is already rare. */
const CODE_TRIES = 3

export const createLink: RouteHandler<typeof createLinkRoute, AuthEnv> = async (c) => {
  const { expiresOn, ...link } = c.req.valid('json')

  for (let i = 0; i < CODE_TRIES; i++) {
    const [created] = await c.var.db
      .insert(schoolLinks)
      .values({
        ...link,
        code: newLinkCode(),
        createdBy: c.var.profile.id,
        expiresAt: linkExpiresAt(expiresOn),
      })
      .onConflictDoNothing({ target: schoolLinks.code })
      .returning({ id: schoolLinks.id })
    if (created) {
      const [row] = await selectLinks(c.var.db, eq(schoolLinks.id, created.id))
      if (row) return c.json(row, 201)
    }
  }
  throw new ApiError('internal_error')
}

export const closeLink: RouteHandler<typeof closeLinkRoute, AuthEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const db = c.var.db

  // Only an open one gets a closing time, so closing twice keeps the first.
  await db
    .update(schoolLinks)
    .set({ closedAt: new Date() })
    .where(and(eq(schoolLinks.id, id), isNull(schoolLinks.closedAt)))

  const [link] = await selectLinks(db, eq(schoolLinks.id, id))
  if (!link) throw new ApiError('not_found', 'We couldn’t find this link.')
  return c.json(link, 200)
}
