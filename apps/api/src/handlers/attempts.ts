import {
  answers,
  areaResults,
  attempts,
  choices,
  competencyAreas,
  questions,
  respondents,
} from '@digibridge/db'
import {
  ANSWER_GRACE_SECONDS,
  ATTEMPT_DURATION_MINUTES,
  type AreaCode,
  type AttemptStatus,
} from '@digibridge/shared'
import type { RouteHandler } from '@hono/zod-openapi'
import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import type { Db } from '../config/db'
import type { AuthEnv } from '../env'
import { pickItems, type PoolItem } from '../lib/pick-items'
import { roundPct, scoreAttempt, type ScoredItem } from '../lib/scoring'
import { ApiError } from '../middleware'
import type {
  getAttemptRoute,
  saveAnswerRoute,
  startAttemptRoute,
  submitAttemptRoute,
} from '../routes/attempts'

const ALREADY_TAKEN = 'You already took the assessment.'
const NOT_READY = 'The assessment isn’t ready yet. Please try again later.'

const summaryColumns = {
  id: attempts.id,
  status: attempts.status,
  startedAt: attempts.startedAt,
  expiresAt: attempts.expiresAt,
}
type Summary = { id: string; status: AttemptStatus; startedAt: Date; expiresAt: Date }

/** The respondent's one attempt that isn't voided, if any. */
async function currentAttempt(db: Db, respondentId: string) {
  const [row] = await db
    .select(summaryColumns)
    .from(attempts)
    .where(and(eq(attempts.respondentId, respondentId), ne(attempts.status, 'voided')))
  return row
}

/** Active questions with their choices, as the pool for a new attempt. */
async function activePool(db: Db): Promise<PoolItem[]> {
  const rows = await db
    .select({
      id: questions.id,
      area: competencyAreas.code,
      difficulty: questions.difficulty,
      choiceId: choices.id,
    })
    .from(questions)
    .innerJoin(competencyAreas, eq(competencyAreas.id, questions.areaId))
    .innerJoin(choices, eq(choices.questionId, questions.id))
    .where(eq(questions.isActive, true))

  const pool = new Map<string, PoolItem & { choiceIds: string[] }>()
  for (const row of rows) {
    const item = pool.get(row.id)
    if (item) item.choiceIds.push(row.choiceId)
    // Area codes are the seeded AREA_CODES; an unknown one simply never gets picked.
    else pool.set(row.id, { ...row, area: row.area as AreaCode, choiceIds: [row.choiceId] })
  }
  return [...pool.values()]
}

export const startAttempt: RouteHandler<typeof startAttemptRoute, AuthEnv> = async (c) => {
  const db = c.var.db
  const reply = (attempt: Summary, status: 200 | 201) =>
    c.json(
      {
        id: attempt.id,
        status: attempt.status,
        startedAt: attempt.startedAt.toISOString(),
        expiresAt: attempt.expiresAt.toISOString(),
        serverTime: new Date().toISOString(),
      },
      status,
    )

  const [respondent] = await db
    .select({ id: respondents.id })
    .from(respondents)
    .where(eq(respondents.profileId, c.var.profile.id))
  if (!respondent) throw new ApiError('conflict', 'Fill in your profile before you start.')

  // An attempt in progress is returned as it is (ASM-07); a finished one can't be retaken.
  const existing = await currentAttempt(db, respondent.id)
  if (existing) {
    if (existing.status !== 'in_progress') throw new ApiError('conflict', ALREADY_TAKEN)
    return reply(existing, 200)
  }

  const picked = pickItems(await activePool(db))
  if (!picked.ok) {
    console.error('Too few active items to start an attempt', picked.shortfalls)
    throw new ApiError('conflict', NOT_READY)
  }

  const startedAt = new Date()
  const expiresAt = new Date(startedAt.getTime() + ATTEMPT_DURATION_MINUTES * 60_000)
  // The partial unique index allows one attempt per respondent that isn't voided, so a second
  // start sent at the same moment inserts nothing and gets the first one's attempt.
  const [created] = await db
    .insert(attempts)
    .values({
      respondentId: respondent.id,
      startedAt,
      expiresAt,
      questionOrder: picked.questionOrder,
      choiceOrder: picked.choiceOrder,
    })
    .onConflictDoNothing()
    .returning(summaryColumns)
  if (created) return reply(created, 201)

  const winner = await currentAttempt(db, respondent.id)
  if (winner?.status === 'in_progress') return reply(winner, 200)
  throw new ApiError('conflict', ALREADY_TAKEN)
}

// ---- Reading, answering and submitting ----

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

const NOT_FOUND = 'We couldn’t find this assessment.'

/**
 * The attempt with this ID, if it belongs to the signed-in user's respondent. `lock` takes a row
 * lock inside a transaction: `share` while saving an answer, `update` while submitting, so an
 * answer can't land after the attempt is scored.
 */
async function ownAttempt(
  db: Db | Tx,
  profileId: string,
  attemptId: string,
  lock?: 'share' | 'update',
) {
  const query = db
    .select({
      id: attempts.id,
      status: attempts.status,
      startedAt: attempts.startedAt,
      expiresAt: attempts.expiresAt,
      submittedAt: attempts.submittedAt,
      questionOrder: attempts.questionOrder,
      choiceOrder: attempts.choiceOrder,
    })
    .from(attempts)
    .innerJoin(respondents, eq(respondents.id, attempts.respondentId))
    .where(and(eq(attempts.id, attemptId), eq(respondents.profileId, profileId)))
  const [row] = await (lock ? query.for(lock, { of: attempts }) : query)
  if (!row) throw new ApiError('not_found', NOT_FOUND)
  return row
}

/** Answers are taken until `expires_at` plus the grace period, for saves already in flight. */
const timeIsUp = (expiresAt: Date, now: Date) =>
  now.getTime() > expiresAt.getTime() + ANSWER_GRACE_SECONDS * 1000

export const getAttempt: RouteHandler<typeof getAttemptRoute, AuthEnv> = async (c) => {
  const db = c.var.db
  const attempt = await ownAttempt(db, c.var.profile.id, c.req.valid('param').id)

  const rows = await db
    .select({
      id: questions.id,
      area: competencyAreas.code,
      stem: questions.stem,
      imageUrl: questions.imageUrl,
      isScenario: questions.isScenario,
      choiceId: choices.id,
      label: choices.label,
    })
    .from(questions)
    .innerJoin(competencyAreas, eq(competencyAreas.id, questions.areaId))
    .innerJoin(choices, eq(choices.questionId, questions.id))
    .where(inArray(questions.id, attempt.questionOrder))
  const saved = await db
    .select({ questionId: answers.questionId, choiceId: answers.choiceId })
    .from(answers)
    .where(eq(answers.attemptId, attempt.id))

  const labels = new Map(rows.map((row) => [row.choiceId, row.label]))
  const questionRows = new Map(rows.map((row) => [row.id, row]))
  // The stored order, not the database's: it is the shuffle this attempt was given (ASM-02).
  const items = attempt.questionOrder.flatMap((id) => {
    const row = questionRows.get(id)
    if (!row) return []
    const order = attempt.choiceOrder[id] ?? []
    return [
      {
        id,
        // Area codes are the seeded AREA_CODES.
        area: row.area as AreaCode,
        stem: row.stem,
        imageUrl: row.imageUrl,
        isScenario: row.isScenario,
        choices: order.flatMap((choiceId) => {
          const label = labels.get(choiceId)
          return label === undefined ? [] : [{ id: choiceId, label }]
        }),
      },
    ]
  })

  return c.json(
    {
      id: attempt.id,
      status: attempt.status,
      startedAt: attempt.startedAt.toISOString(),
      expiresAt: attempt.expiresAt.toISOString(),
      serverTime: new Date().toISOString(),
      items,
      answers: saved,
    },
    200,
  )
}

export const saveAnswer: RouteHandler<typeof saveAnswerRoute, AuthEnv> = async (c) => {
  const { id, questionId } = c.req.valid('param')
  const { choiceId } = c.req.valid('json')

  const saved = await c.var.db.transaction(async (tx) => {
    const attempt = await ownAttempt(tx, c.var.profile.id, id, 'share')
    const now = new Date()
    if (attempt.status !== 'in_progress') {
      throw new ApiError('conflict', 'This assessment is already closed.')
    }
    if (timeIsUp(attempt.expiresAt, now)) {
      throw new ApiError('conflict', 'Time is up, so this answer wasn’t saved.')
    }
    // choiceOrder holds exactly the attempt's items and each one's own choices.
    const own = attempt.choiceOrder[questionId]
    if (!own) throw new ApiError('bad_request', 'This question isn’t part of your assessment.')
    if (!own.includes(choiceId)) {
      throw new ApiError('bad_request', 'This answer isn’t one of the question’s choices.')
    }

    const [row] = await tx
      .insert(answers)
      .values({ attemptId: attempt.id, questionId, choiceId, answeredAt: now })
      .onConflictDoUpdate({
        target: [answers.attemptId, answers.questionId],
        set: { choiceId, answeredAt: now },
      })
      .returning({ answeredAt: answers.answeredAt })
    return row!
  })

  return c.json(
    {
      questionId,
      choiceId,
      answeredAt: saved.answeredAt.toISOString(),
      serverTime: new Date().toISOString(),
    },
    200,
  )
}

/** Scores the attempt and closes it, in the caller's transaction (the attempt row is locked). */
async function scoreAndClose(
  tx: Tx,
  attempt: { id: string; expiresAt: Date; questionOrder: string[] },
  now: Date,
) {
  const items = await tx
    .select({
      questionId: questions.id,
      areaId: questions.areaId,
      area: competencyAreas.code,
      difficulty: questions.difficulty,
      correctChoiceId: choices.id,
    })
    .from(questions)
    .innerJoin(competencyAreas, eq(competencyAreas.id, questions.areaId))
    .leftJoin(choices, and(eq(choices.questionId, questions.id), eq(choices.isCorrect, true)))
    .where(inArray(questions.id, attempt.questionOrder))
  const saved = await tx
    .select({ questionId: answers.questionId, choiceId: answers.choiceId })
    .from(answers)
    .where(eq(answers.attemptId, attempt.id))

  const score = scoreAttempt(
    items.map((item): ScoredItem => ({ ...item, area: item.area as AreaCode })),
    new Map(saved.map((a) => [a.questionId, a.choiceId])),
  )

  if (score.answerPoints.size > 0) {
    const values = [...score.answerPoints].map(
      ([questionId, points]) => sql`(${questionId}::uuid, ${points}::smallint)`,
    )
    await tx.execute(sql`
      update ${answers} set points = v.points
      from (values ${sql.join(values, sql`, `)}) as v(question_id, points)
      where ${answers.attemptId} = ${attempt.id} and ${answers.questionId} = v.question_id`)
  }

  const areaIds = new Map(items.map((item) => [item.area, item.areaId]))
  if (score.areas.length > 0) {
    await tx.insert(areaResults).values(
      score.areas.map((area) => ({
        attemptId: attempt.id,
        areaId: areaIds.get(area.area)!,
        points: area.points,
        maxPoints: area.maxPoints,
        pct: roundPct(area.pct),
        level: area.level,
      })),
    )
  }

  // Sent in time (or within the grace period), it's submitted. Later, the clock already closed it:
  // expired, at expires_at, as the cron would have done.
  const late = timeIsUp(attempt.expiresAt, now)
  const [closed] = await tx
    .update(attempts)
    .set({
      status: late ? 'expired' : 'submitted',
      submittedAt: late ? attempt.expiresAt : now,
      totalPoints: score.overall.points,
      overallPct: roundPct(score.overall.pct),
      overallLevel: score.overall.level,
    })
    .where(eq(attempts.id, attempt.id))
    .returning({
      id: attempts.id,
      status: attempts.status,
      expiresAt: attempts.expiresAt,
      submittedAt: attempts.submittedAt,
    })
  return closed!
}

export const submitAttempt: RouteHandler<typeof submitAttemptRoute, AuthEnv> = async (c) => {
  const id = c.req.valid('param').id

  const closed = await c.var.db.transaction(async (tx) => {
    const attempt = await ownAttempt(tx, c.var.profile.id, id, 'update')
    if (attempt.status === 'voided') {
      throw new ApiError('conflict', 'This assessment was cancelled by the team.')
    }
    // Already closed (a second tap, or the timer and the button at once): return it as it is.
    if (attempt.status !== 'in_progress') return attempt
    return scoreAndClose(tx, attempt, new Date())
  })

  // The status is submitted or expired here. The schema doesn't make submitted_at required, so a
  // row closed some other way (the cron, a fix by hand) may lack it: it closed at expires_at then.
  return c.json(
    {
      id: closed.id,
      status: closed.status as 'submitted' | 'expired',
      submittedAt: (closed.submittedAt ?? closed.expiresAt).toISOString(),
    },
    200,
  )
}
