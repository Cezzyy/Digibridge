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
import { and, eq, exists, ne, notExists, sql, type SQL } from 'drizzle-orm'
import type { AppEnv } from '../env'
import type { Tx } from '../lib/close-attempt'
import { linkResponses } from '../lib/link-responses'
import { checkAgeOnConsentDay } from '../lib/respondent'
import { hashRespondentToken, isRespondentToken, newRespondentToken } from '../lib/respondent-token'
import { ApiError, UNKNOWN_TOKEN_MESSAGE } from '../middleware'
import type { getLinkRoute, joinLinkRoute } from '../routes/links'

const NOT_FOUND = 'We couldn’t find this link. Check that you have the whole address.'
const NUMBER_USED =
  'This student number has already been used. If this is you, ask the DigiBridge team for help.'

/**
 * The respondent has voided attempts and no other (USR-03), so their student number may join a
 * link again and start over. One who never started can't: their number stays theirs.
 */
const onlyVoidedAttempts = (db: Tx) => {
  const theirs = (status: SQL) =>
    db
      .select({ one: sql`1` })
      .from(attempts)
      .where(and(eq(attempts.respondentId, respondents.id), status))
  return and(
    exists(theirs(eq(attempts.status, 'voided'))),
    notExists(theirs(ne(attempts.status, 'voided'))),
  )!
}

/** Codes are upper case; one typed or pasted in lower case still opens the link. */
const normalizeCode = (code: string) => code.trim().toUpperCase()

export const getLink: RouteHandler<typeof getLinkRoute, AppEnv> = async (c) => {
  const code = normalizeCode(c.req.valid('param').code)
  const token = c.req.header(RESPONDENT_TOKEN_HEADER)
  if (token !== undefined && !isRespondentToken(token)) {
    throw new ApiError('unauthorized', UNKNOWN_TOKEN_MESSAGE)
  }
  const tokenHash = token === undefined ? null : await hashRespondentToken(token)

  // One query: the link, its response count, and with a token, the student who joined through
  // this link and their attempt that isn't voided (at most one of each). Only a new student (no
  // token) is checked against the limit, and only a link with a limit needs counting, so the
  // count runs in that case alone; otherwise it's 0, which linkStatus never reads.
  const db = c.var.db
  const responses =
    tokenHash === null
      ? sql<number>`case when ${schoolLinks.maxResponses} is null then 0 else ${linkResponses(db, schoolLinks.id)} end`
      : sql<number>`0`
  const [row] = await db
    .select({
      code: schoolLinks.code,
      school: schoolLinks.school,
      label: schoolLinks.label,
      course: schoolLinks.course,
      yearLevel: schoolLinks.yearLevel,
      maxResponses: schoolLinks.maxResponses,
      expiresAt: schoolLinks.expiresAt,
      closedAt: schoolLinks.closedAt,
      responses: responses.mapWith(Number),
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

/** The student number belongs to a student who joined this link and had every attempt voided. */
async function rejoiningHere(tx: Tx, linkId: string, studentNumber: string) {
  const [found] = await tx
    .select({ id: respondents.id })
    .from(respondents)
    .where(
      and(
        eq(respondents.studentNumber, studentNumber),
        eq(respondents.schoolLinkId, linkId),
        onlyVoidedAttempts(tx),
      ),
    )
  return !!found
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
    const responses = link.maxResponses === null ? 0 : await linkResponses(tx, link.id)
    let status = linkStatus({ ...link, responses }, consentedAt)
    // A full link still lets back in a student already counted on it whose attempt was voided.
    if (status === 'full' && (await rejoiningHere(tx, link.id, profile.studentNumber))) {
      status = 'open'
    }
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
    if (row) return row

    // The number is taken. If every attempt under it was voided, the student starts over in the
    // same row: the new profile and consent, this link, and a new token, so a browser that still
    // holds the old one loses its place. The row is locked first, so the check below runs after
    // an attempt start (`for share` on this row) or another rejoin through another link has
    // committed, and sees what it did.
    await tx
      .select({ id: respondents.id })
      .from(respondents)
      .where(eq(respondents.studentNumber, profile.studentNumber))
      .for('update')
    const [rejoined] = await tx
      .update(respondents)
      .set({
        ...profile,
        schoolLinkId: link.id,
        accessTokenHash: hash,
        consentVersion,
        consentedAt,
      })
      .where(and(eq(respondents.studentNumber, profile.studentNumber), onlyVoidedAttempts(tx)))
      .returning({ id: respondents.id, fullName: respondents.fullName })
    if (!rejoined) throw new ApiError('conflict', NUMBER_USED)
    return rejoined
  })

  return c.json({ respondent: created, token }, 201)
}
