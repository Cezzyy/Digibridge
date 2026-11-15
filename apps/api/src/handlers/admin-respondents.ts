import {
  answers,
  areaResults,
  attempts,
  choices,
  competencyAreas,
  questions,
  respondents,
  schoolLinks,
  susResponses,
} from '@digibridge/db'
import {
  ageGroupFor,
  FINISHED_ATTEMPT_STATUSES,
  RESPONDENTS_PAGE_SIZE,
  type AreaCode,
  type Level,
  type RespondentSort,
  type RespondentStatus,
} from '@digibridge/shared'
import type { RouteHandler } from '@hono/zod-openapi'
import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql, type SQL } from 'drizzle-orm'
import type { Db } from '../config/db'
import type { AuthEnv } from '../env'
import {
  ageAtConsent,
  currentAttemptOrder,
  currentAttempts,
  dashboardConditions,
  type CurrentAttempts,
} from '../lib/dashboard-filters'
import { newRespondentToken } from '../lib/respondent-token'
import { ApiError } from '../middleware'
import type {
  deleteRespondentRoute,
  getRespondentRoute,
  listRespondentsRoute,
  voidAttemptRoute,
} from '../routes/admin-respondents'

/** RESPONDENT_STATUSES from the respondent's attempt. Submitted and expired both have results. */
const statusOf = (current: CurrentAttempts) =>
  sql<RespondentStatus>`case
    when ${current.id} is null then 'not_started'
    when ${current.status} = 'in_progress' then 'in_progress'
    when ${current.status} = 'voided' then 'voided'
    else 'finished' end`

/** The attempt's score and level, or null unless it's finished: a voided attempt is left out. */
const finishedScore = (current: CurrentAttempts) => {
  const finished = inArray(current.status, FINISHED_ATTEMPT_STATUSES)
  return {
    pct: sql<number | null>`case when ${finished} then ${current.overallPct} end`.mapWith(
      current.overallPct,
    ),
    level: sql<Level | null>`case when ${finished} then ${current.overallLevel} end`,
  }
}

/** Hidden names sort last, as if blank, so their place in the list gives nothing away (PRO-05). */
const orderFor = (sort: RespondentSort, current: CurrentAttempts): SQL[] => {
  const newest = [desc(respondents.consentedAt), desc(respondents.id)]
  switch (sort) {
    case 'newest':
      return newest
    case 'oldest':
      return [asc(respondents.consentedAt), asc(respondents.id)]
    case 'name':
      return [
        sql`case when ${respondents.showIdentity} then ${respondents.fullName} end asc nulls last`,
        ...newest,
      ]
    case 'score_high':
      return [sql`${finishedScore(current).pct} desc nulls last`, ...newest]
    case 'score_low':
      return [sql`${finishedScore(current).pct} asc nulls last`, ...newest]
  }
}

/** `%text%` for ILIKE, with the search's own `%`, `_` and `\` matched as themselves. */
const containing = (text: string) => `%${text.replace(/[\\%_]/g, '\\$&')}%`

/** Respondents with their attempt and the link they joined through, as table rows. */
function selectRespondents(db: Db, current: CurrentAttempts) {
  return db
    .select({
      id: respondents.id,
      mode: respondents.mode,
      fullName: respondents.fullName,
      studentNumber: respondents.studentNumber,
      showIdentity: respondents.showIdentity,
      course: respondents.course,
      yearLevel: respondents.yearLevel,
      sex: respondents.sex,
      age: ageAtConsent,
      devices: respondents.devices,
      internetAccess: respondents.internetAccess,
      consentedAt: respondents.consentedAt,
      status: statusOf(current),
      linkId: schoolLinks.id,
      linkLabel: schoolLinks.label,
      attemptId: current.id,
      overallPct: finishedScore(current).pct,
      overallLevel: finishedScore(current).level,
      submittedAt: current.submittedAt,
    })
    .from(respondents)
    .leftJoin(current, eq(current.respondentId, respondents.id))
    .leftJoin(schoolLinks, eq(schoolLinks.id, respondents.schoolLinkId))
}

type Row = Awaited<ReturnType<typeof selectRespondents>>[number]

/** A row as the API sends it, with the name and student number left out when hidden (PRO-05). */
const toRespondent = ({ showIdentity, linkId, linkLabel, ...row }: Row) => ({
  ...row,
  fullName: showIdentity ? row.fullName : null,
  studentNumber: showIdentity ? row.studentNumber : null,
  identityHidden: !showIdentity,
  ageGroup: ageGroupFor(row.age),
  consentedAt: row.consentedAt.toISOString(),
  schoolLink: linkId && linkLabel ? { id: linkId, label: linkLabel } : null,
  submittedAt: row.submittedAt?.toISOString() ?? null,
})

export const listRespondents: RouteHandler<typeof listRespondentsRoute, AuthEnv> = async (c) => {
  const { status, q, sort, page, ...filters } = c.req.valid('query')
  const db = c.var.db
  const current = currentAttempts(db)

  const conditions = dashboardConditions(filters)
  if (status) conditions.push(sql`${statusOf(current)} = ${status}`)
  if (q) {
    // Only shown identities can be found by name or student number (PRO-05).
    conditions.push(
      and(
        eq(respondents.showIdentity, true),
        or(
          ilike(respondents.fullName, containing(q)),
          ilike(respondents.studentNumber, containing(q)),
        ),
      )!,
    )
  }
  const where = and(...conditions)

  const [rows, [counted]] = await Promise.all([
    selectRespondents(db, current)
      .where(where)
      .orderBy(...orderFor(sort, current))
      .limit(RESPONDENTS_PAGE_SIZE)
      .offset((page - 1) * RESPONDENTS_PAGE_SIZE),
    db
      .select({ total: count() })
      .from(respondents)
      .leftJoin(current, eq(current.respondentId, respondents.id))
      .where(where),
  ])

  return c.json(
    {
      respondents: rows.map(toRespondent),
      total: counted?.total ?? 0,
      page,
      pageSize: RESPONDENTS_PAGE_SIZE,
    },
    200,
  )
}

/** Each item of the attempt in the order shown, with its choices in the order shown. */
async function answerSheet(
  db: Db,
  attempt: { id: string; questionOrder: string[]; choiceOrder: Record<string, string[]> },
) {
  const ids = attempt.questionOrder
  if (ids.length === 0) return []
  const [items, itemChoices, picked] = await Promise.all([
    db
      .select({
        id: questions.id,
        area: competencyAreas.code,
        difficulty: questions.difficulty,
        stem: questions.stem,
      })
      .from(questions)
      .innerJoin(competencyAreas, eq(competencyAreas.id, questions.areaId))
      .where(inArray(questions.id, ids)),
    db
      .select({
        id: choices.id,
        questionId: choices.questionId,
        label: choices.label,
        isCorrect: choices.isCorrect,
      })
      .from(choices)
      .where(inArray(choices.questionId, ids)),
    db
      .select({
        questionId: answers.questionId,
        choiceId: answers.choiceId,
        points: answers.points,
      })
      .from(answers)
      .where(eq(answers.attemptId, attempt.id)),
  ])

  const itemById = new Map(items.map((item) => [item.id, item]))
  const choiceById = new Map(itemChoices.map((choice) => [choice.id, choice]))
  const answerByItem = new Map(picked.map((answer) => [answer.questionId, answer]))

  return ids.flatMap((id) => {
    const item = itemById.get(id)
    if (!item) return []
    const shown = (attempt.choiceOrder[id] ?? []).flatMap((choiceId) => {
      const choice = choiceById.get(choiceId)
      return choice ? [{ id: choice.id, label: choice.label, isCorrect: choice.isCorrect }] : []
    })
    const answer = answerByItem.get(id)
    return [
      {
        questionId: id,
        // Area codes are the seeded AREA_CODES.
        area: item.area as AreaCode,
        difficulty: item.difficulty,
        stem: item.stem,
        choices: shown,
        pickedChoiceId: answer?.choiceId ?? null,
        correct: !!answer && choiceById.get(answer.choiceId)?.isCorrect === true,
        points: answer?.points ?? null,
      },
    ]
  })
}

export const getRespondent: RouteHandler<typeof getRespondentRoute, AuthEnv> = async (c) => {
  const db = c.var.db
  const id = c.req.valid('param').id
  // The row and the whole attempt at once: the same attempt `currentAttempts` picks, taken by
  // the respondent's ID, so it doesn't wait on the row's attempt ID.
  const [[row], [attempt]] = await Promise.all([
    selectRespondents(db, currentAttempts(db)).where(eq(respondents.id, id)),
    db
      .select()
      .from(attempts)
      .where(eq(attempts.respondentId, id))
      .orderBy(...currentAttemptOrder)
      .limit(1),
  ])
  if (!row) throw new ApiError('not_found', 'We couldn’t find this respondent.')
  const respondent = toRespondent(row)
  if (!attempt) return c.json({ respondent, attempt: null }, 200)

  // The per-item answers show the right choices, so only admins get them.
  const [areas, [sus], sheet] = await Promise.all([
    db
      .select({
        area: competencyAreas.code,
        points: areaResults.points,
        maxPoints: areaResults.maxPoints,
        pct: areaResults.pct,
        level: areaResults.level,
      })
      .from(areaResults)
      .innerJoin(competencyAreas, eq(competencyAreas.id, areaResults.areaId))
      .where(eq(areaResults.attemptId, attempt.id))
      .orderBy(competencyAreas.sortOrder),
    db.select().from(susResponses).where(eq(susResponses.attemptId, attempt.id)),
    c.var.profile.role === 'admin' ? answerSheet(db, attempt) : null,
  ])
  const { submittedAt, startedAt } = attempt

  return c.json(
    {
      respondent,
      attempt: {
        id: attempt.id,
        status: attempt.status,
        startedAt: startedAt.toISOString(),
        expiresAt: attempt.expiresAt.toISOString(),
        submittedAt: submittedAt?.toISOString() ?? null,
        timeTakenSeconds: submittedAt
          ? Math.round((submittedAt.getTime() - startedAt.getTime()) / 1000)
          : null,
        totalPoints: attempt.totalPoints,
        overallPct: attempt.overallPct,
        overallLevel: attempt.overallLevel,
        voidReason: attempt.voidReasonCode,
        voidNote: attempt.voidNote,
        voidedAt: attempt.voidedAt?.toISOString() ?? null,
        areas: areas.map((area) => ({ ...area, area: area.area as AreaCode })),
        sus: sus
          ? {
              score: sus.score,
              answers: [
                sus.q1,
                sus.q2,
                sus.q3,
                sus.q4,
                sus.q5,
                sus.q6,
                sus.q7,
                sus.q8,
                sus.q9,
                sus.q10,
              ],
            }
          : null,
        answers: sheet,
      },
    },
    200,
  )
}

/**
 * Deletes a respondent on their request (USR-03). Their attempts, answers, area results and SUS
 * response go with them through the foreign keys' cascades.
 */
export const deleteRespondent: RouteHandler<typeof deleteRespondentRoute, AuthEnv> = async (c) => {
  const [deleted] = await c.var.db
    .delete(respondents)
    .where(eq(respondents.id, c.req.valid('param').id))
    .returning({ id: respondents.id })
  if (!deleted) throw new ApiError('not_found', 'We couldn’t find this respondent.')
  return c.body(null, 204)
}

/**
 * Voids an attempt in progress or finished (USR-03). One statement: the update waits for a submit
 * (`for update`) or an answer save (`for share`) holding the row, then checks the status again, so
 * the attempt is voided after them, never in between. A school respondent's token is replaced in
 * the same statement by the hash of one nobody holds: whoever took it (maybe under someone else's
 * student number) can't start again from that browser, and the student comes back by joining the
 * link again, which takes the number back (`joinLink`).
 */
export const voidAttempt: RouteHandler<typeof voidAttemptRoute, AuthEnv> = async (c) => {
  const db = c.var.db
  const { id } = c.req.valid('param')
  const { reason, note } = c.req.valid('json')
  const { hash } = await newRespondentToken()

  const done = db.$with('done').as(
    db
      .update(attempts)
      .set({
        status: 'voided',
        voidReasonCode: reason,
        voidNote: note || null,
        voidedAt: sql`now()`,
        voidedBy: c.var.profile.id,
      })
      .where(and(eq(attempts.id, id), ne(attempts.status, 'voided')))
      .returning({
        id: attempts.id,
        respondentId: attempts.respondentId,
        voidReason: attempts.voidReasonCode,
        voidNote: attempts.voidNote,
        voidedAt: attempts.voidedAt,
      }),
  )
  const signedOut = db.$with('signed_out').as(
    db
      .update(respondents)
      .set({ accessTokenHash: hash })
      .where(
        and(
          eq(respondents.mode, 'school'),
          inArray(respondents.id, db.select({ id: done.respondentId }).from(done)),
        ),
      )
      .returning({ id: respondents.id }),
  )
  const [voided] = await db
    .with(done, signedOut)
    .select({
      id: done.id,
      voidReason: done.voidReason,
      voidNote: done.voidNote,
      voidedAt: done.voidedAt,
    })
    .from(done)
  if (voided?.voidReason && voided.voidedAt) {
    return c.json(
      {
        attempt: {
          id: voided.id,
          status: 'voided' as const,
          voidReason: voided.voidReason,
          voidNote: voided.voidNote,
          voidedAt: voided.voidedAt.toISOString(),
        },
      },
      200,
    )
  }

  const [found] = await db.select({ id: attempts.id }).from(attempts).where(eq(attempts.id, id))
  if (!found) throw new ApiError('not_found', 'We couldn’t find this attempt.')
  throw new ApiError('conflict', 'This attempt is already voided.')
}
