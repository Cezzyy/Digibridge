import { attempts, respondents, schoolLinks } from '@digibridge/db'
import {
  LINK_GONE_MESSAGES,
  linkLockIssues,
  linkStatus,
  RESPONDENT_TOKEN_HEADER,
  type Course,
  type YearLevel,
} from '@digibridge/shared'
import type { RouteHandler } from '@hono/zod-openapi'
import { and, eq, ne, sql } from 'drizzle-orm'
import type { AppEnv } from '../env'
import { checkAgeOnConsentDay } from '../lib/respondent'
import { hashRespondentToken, isRespondentToken, newRespondentToken } from '../lib/respondent-token'
import { ApiError, UNKNOWN_TOKEN_MESSAGE } from '../middleware'
import type { getLinkRoute, joinLinkRoute } from '../routes/links'

const NOT_FOUND = 'We couldn’t find this link. Check that you have the whole address.'
const NUMBER_USED =
  'This student number has already been used. If this is you, ask the DigiBridge team for help.'

/** Codes are upper case; one typed or pasted in lower case still opens the link. */
const normalizeCode = (code: string) => code.trim().toUpperCase()

/** How many students have joined through the link so far. */
const responsesOf = (linkId: typeof schoolLinks.id) =>
  sql<number>`(select count(*) from ${respondents} where ${respondents.schoolLinkId} = ${linkId})::int`

export const getLink: RouteHandler<typeof getLinkRoute, AppEnv> = async (c) => {
  const code = normalizeCode(c.req.valid('param').code)
  const token = c.req.header(RESPONDENT_TOKEN_HEADER)
  if (token !== undefined && !isRespondentToken(token)) {
    throw new ApiError('unauthorized', UNKNOWN_TOKEN_MESSAGE)
  }
  const tokenHash = token === undefined ? null : await hashRespondentToken(token)

  // One query: the link, its response count, and with a token, the student who joined through
  // this link and their attempt that isn't voided (at most one of each).
  const [row] = await c.var.db
    .select({
      code: schoolLinks.code,
      school: schoolLinks.school,
      label: schoolLinks.label,
      course: schoolLinks.course,
      yearLevel: schoolLinks.yearLevel,
      maxResponses: schoolLinks.maxResponses,
      expiresAt: schoolLinks.expiresAt,
      closedAt: schoolLinks.closedAt,
      responses: responsesOf(schoolLinks.id),
      respondentId: respondents.id,
      fullName: respondents.fullName,
      attemptId: attempts.id,
      attemptStatus: attempts.status,
    })
    .from(schoolLinks)
    .leftJoin(
      respondents,
      tokenHash === null
        ? sql`false`
        : and(
            eq(respondents.schoolLinkId, schoolLinks.id),
            eq(respondents.accessTokenHash, tokenHash),
          ),
    )
    .leftJoin(
      attempts,
      and(eq(attempts.respondentId, respondents.id), ne(attempts.status, 'voided')),
    )
    .where(eq(schoolLinks.code, code))

  if (!row) throw new ApiError('not_found', NOT_FOUND)
  if (tokenHash !== null && row.respondentId === null) {
    throw new ApiError('unauthorized', UNKNOWN_TOKEN_MESSAGE)
  }
  // A student who already joined can always come back; only new ones need the link open.
  if (row.respondentId === null) {
    const status = linkStatus(row)
    if (status !== 'open') throw new ApiError('gone', LINK_GONE_MESSAGES[status])
  }

  return c.json(
    {
      code: row.code,
      school: row.school,
      label: row.label,
      // Saved through schoolLinkSchema, so they're from the shared lists.
      course: row.course as Course | null,
      yearLevel: row.yearLevel as YearLevel | null,
      respondent:
        row.respondentId === null || row.fullName === null
          ? null
          : { id: row.respondentId, fullName: row.fullName },
      attempt:
        row.attemptId === null || row.attemptStatus === null
          ? null
          : { id: row.attemptId, status: row.attemptStatus },
    },
    200,
  )
}

export const joinLink: RouteHandler<typeof joinLinkRoute, AppEnv> = async (c) => {
  const code = normalizeCode(c.req.valid('param').code)
  const { consentVersion, ...profile } = c.req.valid('json')
  const consentedAt = new Date()
  checkAgeOnConsentDay(profile.birthDate, consentedAt)
  const { token, hash } = await newRespondentToken()

  const created = await c.var.db.transaction(async (tx) => {
    // The lock makes students joining at the same moment take turns, so the count below is the
    // real one and a limit of 40 lets in 40.
    const [link] = await tx
      .select({
        id: schoolLinks.id,
        course: schoolLinks.course,
        yearLevel: schoolLinks.yearLevel,
        maxResponses: schoolLinks.maxResponses,
        expiresAt: schoolLinks.expiresAt,
        closedAt: schoolLinks.closedAt,
      })
      .from(schoolLinks)
      .where(eq(schoolLinks.code, code))
      .for('update')
    if (!link) throw new ApiError('not_found', NOT_FOUND)

    // Counted only when there's a limit to count against.
    const responses =
      link.maxResponses === null
        ? 0
        : await tx.$count(respondents, eq(respondents.schoolLinkId, link.id))
    const status = linkStatus({ ...link, responses }, consentedAt)
    if (status !== 'open') throw new ApiError('gone', LINK_GONE_MESSAGES[status])

    const [issue] = linkLockIssues(link, profile)
    if (issue) throw new ApiError('validation_failed', issue.message)

    // student_number is unique: a number used through any link, even one sent at the same
    // moment, inserts nothing (PRO-03).
    const [row] = await tx
      .insert(respondents)
      .values({
        ...profile,
        mode: 'school',
        schoolLinkId: link.id,
        accessTokenHash: hash,
        consentVersion,
        consentedAt,
      })
      .onConflictDoNothing({ target: respondents.studentNumber })
      .returning({ id: respondents.id, fullName: respondents.fullName })
    if (!row) throw new ApiError('conflict', NUMBER_USED)
    return row
  })

  return c.json({ respondent: created, token }, 201)
}
