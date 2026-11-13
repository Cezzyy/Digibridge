import { attempts, profiles, respondents, schoolLinks } from '@digibridge/db'
import { FINISHED_ATTEMPT_STATUSES, linkExpiresAt, linkStatus } from '@digibridge/shared'
import type { RouteHandler } from '@hono/zod-openapi'
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  inArray,
  isNull,
  sql,
  type SQL,
} from 'drizzle-orm'
import type { Db } from '../config/db'
import type { AuthEnv } from '../env'
import { newLinkCode } from '../lib/link-code'
import { linkResponses } from '../lib/link-responses'
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
      responses: linkResponses(db, schoolLinks.id),
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
  const [byMode, [attemptCounts], linkStates] = await Promise.all([
    db
      .select({ mode: respondents.mode, count: count() })
      .from(respondents)
      .groupBy(respondents.mode),
    db
      .select({
        inProgress: count(sql`case when ${attempts.status} = 'in_progress' then 1 end`),
        finished: count(
          sql`case when ${inArray(attempts.status, FINISHED_ATTEMPT_STATUSES)} then 1 end`,
        ),
      })
      .from(attempts),
    // Only what linkStatus needs, without the creator or the rest of each link.
    db
      .select({
        closedAt: schoolLinks.closedAt,
        expiresAt: schoolLinks.expiresAt,
        maxResponses: schoolLinks.maxResponses,
        responses: linkResponses(db, schoolLinks.id),
      })
      .from(schoolLinks),
  ])

  const online = byMode.find((row) => row.mode === 'online')?.count ?? 0
  const school = byMode.find((row) => row.mode === 'school')?.count ?? 0
  const now = new Date()
  return c.json(
    {
      respondents: { total: online + school, online, school },
      attempts: {
        inProgress: attemptCounts?.inProgress ?? 0,
        finished: attemptCounts?.finished ?? 0,
      },
      links: {
        open: linkStates.filter((link) => linkStatus(link, now) === 'open').length,
        total: linkStates.length,
      },
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
    if (!created) continue // the code was taken: draw another
    // The link is saved now, so don't go round again and make a second one.
    const [row] = await selectLinks(c.var.db, eq(schoolLinks.id, created.id))
    if (!row) break
    return c.json(row, 201)
  }
  throw new ApiError('internal_error')
}

export const closeLink: RouteHandler<typeof closeLinkRoute, AuthEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const db = c.var.db

  // Only a link that hasn't closed or expired gets a closing time, so closing twice keeps the
  // first, and an expired link stays expired.
  const now = new Date()
  await db
    .update(schoolLinks)
    .set({ closedAt: now })
    .where(
      and(eq(schoolLinks.id, id), isNull(schoolLinks.closedAt), gt(schoolLinks.expiresAt, now)),
    )

  const [link] = await selectLinks(db, eq(schoolLinks.id, id))
  if (!link) throw new ApiError('not_found', 'We couldn’t find this link.')
  return c.json(link, 200)
}
