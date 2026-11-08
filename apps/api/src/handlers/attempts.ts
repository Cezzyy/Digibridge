import {
  answers,
  areaResults,
  attempts,
  choices,
  competencyAreas,
  lessons,
  questions,
  respondents,
  susResponses,
} from '@digibridge/db'
import {
  ATTEMPT_DURATION_MINUTES,
  LESSON_TIERS_FOR_LEVEL,
  type AreaCode,
  type AttemptStatus,
} from '@digibridge/shared'
import type { RouteHandler } from '@hono/zod-openapi'
import { and, eq, inArray, ne } from 'drizzle-orm'
import type { Db } from '../config/db'
import type { AuthEnv } from '../env'
import { pickItems, type PoolItem } from '../lib/pick-items'
import { scoreAndClose, timeIsUp, type Tx } from '../lib/close-attempt'
import { ApiError } from '../middleware'
import type {
  getAttemptRoute,
  getResultRoute,
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

// ---- Results ----

export const getResult: RouteHandler<typeof getResultRoute, AuthEnv> = async (c) => {
  const db = c.var.db
  const [attempt] = await db
    .select({
      id: attempts.id,
      status: attempts.status,
      expiresAt: attempts.expiresAt,
      submittedAt: attempts.submittedAt,
      totalPoints: attempts.totalPoints,
      overallPct: attempts.overallPct,
      overallLevel: attempts.overallLevel,
      resultsToken: attempts.resultsToken,
      susAttemptId: susResponses.attemptId,
    })
    .from(attempts)
    .innerJoin(respondents, eq(respondents.id, attempts.respondentId))
    .leftJoin(susResponses, eq(susResponses.attemptId, attempts.id))
    .where(
      and(eq(attempts.id, c.req.valid('param').id), eq(respondents.profileId, c.var.profile.id)),
    )
  if (!attempt) throw new ApiError('not_found', NOT_FOUND)
  if (attempt.status === 'in_progress') {
    throw new ApiError('conflict', 'Submit the assessment to see your results.')
  }
  if (attempt.status === 'voided') {
    throw new ApiError('conflict', 'This assessment was cancelled by the team.')
  }
  const { totalPoints, overallPct, overallLevel } = attempt
  // Submit and the cron always score before closing; a row closed some other way may not be.
  if (totalPoints === null || overallPct === null || overallLevel === null) {
    throw new Error(`Attempt ${attempt.id} is closed but has no scores`)
  }

  const rows = await db
    .select({
      areaId: areaResults.areaId,
      area: competencyAreas.code,
      points: areaResults.points,
      maxPoints: areaResults.maxPoints,
      pct: areaResults.pct,
      level: areaResults.level,
    })
    .from(areaResults)
    .innerJoin(competencyAreas, eq(competencyAreas.id, areaResults.areaId))
    .where(eq(areaResults.attemptId, attempt.id))
    .orderBy(competencyAreas.sortOrder)

  // At most one published lesson per area and tier (lessons_one_published_per_tier_idx).
  const published =
    rows.length === 0
      ? []
      : await db
          .select({
            areaId: lessons.areaId,
            tier: lessons.tier,
            slug: lessons.slug,
            title: lessons.title,
            summary: lessons.summary,
          })
          .from(lessons)
          .where(
            and(
              eq(lessons.isPublished, true),
              inArray(
                lessons.areaId,
                rows.map((row) => row.areaId),
              ),
            ),
          )
  const lessonFor = new Map(published.map((l) => [`${l.areaId}:${l.tier}`, l]))

  const areas = rows.map((row) => ({
    // Area codes are the seeded AREA_CODES.
    area: row.area as AreaCode,
    points: row.points,
    maxPoints: row.maxPoints,
    pct: row.pct,
    level: row.level,
    // The level's tiers, the first one to start with (PRD "Levels").
    lessons: LESSON_TIERS_FOR_LEVEL[row.level].map((tier, i) => {
      const lesson = lessonFor.get(`${row.areaId}:${tier}`)
      return {
        tier,
        nextStep: i > 0,
        lesson: lesson ? { slug: lesson.slug, title: lesson.title, summary: lesson.summary } : null,
      }
    }),
  }))

  return c.json(
    {
      id: attempt.id,
      status: attempt.status,
      submittedAt: (attempt.submittedAt ?? attempt.expiresAt).toISOString(),
      overall: {
        points: totalPoints,
        maxPoints: rows.reduce((sum, row) => sum + row.maxPoints, 0),
        pct: overallPct,
        level: overallLevel,
      },
      areas,
      resultsToken: attempt.resultsToken,
      susAnswered: attempt.susAttemptId !== null,
    },
    200,
  )
}
