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
  ANSWER_GRACE_SECONDS,
  ATTEMPT_DURATION_MINUTES,
  FINISHED_ATTEMPT_STATUSES,
  LESSON_TIERS_FOR_LEVEL,
  type AreaCode,
  type AttemptStatus,
} from '@digibridge/shared'
import type { RouteHandler } from '@hono/zod-openapi'
import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import type { Db } from '../config/db'
import type { RespondentEnv, RespondentKey } from '../env'
import { pickItems, type PoolItem } from '../lib/pick-items'
import { scoreAndClose, timeIsUp, type Tx } from '../lib/close-attempt'
import { susScore } from '../lib/sus'
import { ApiError, UNKNOWN_TOKEN_MESSAGE } from '../middleware'
import { respondentIs } from '../lib/respondent'
import type {
  getAttemptRoute,
  getResultRoute,
  saveAnswerRoute,
  saveSusRoute,
  startAttemptRoute,
  submitAttemptRoute,
} from '../routes/attempts'

const ALREADY_TAKEN = 'You already took the assessment.'
const NOT_READY = 'The assessment isn’t ready yet. Please try again later.'
const VOIDED = 'This assessment was cancelled by the team.'

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

export const startAttempt: RouteHandler<typeof startAttemptRoute, RespondentEnv> = async (c) => {
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

  // The respondent and their attempt in one query (at most one row, as in /me), with the item
  // pool loaded alongside: every query is a round trip to the database, so they go out together.
  const key = c.var.respondentKey
  const [[respondent], pool] = await Promise.all([
    db
      .select({
        id: respondents.id,
        schoolLinkId: respondents.schoolLinkId,
        attempt: summaryColumns,
      })
      .from(respondents)
      .leftJoin(
        attempts,
        and(eq(attempts.respondentId, respondents.id), ne(attempts.status, 'voided')),
      )
      .where(respondentIs(key)),
    activePool(db),
  ])
  if (!respondent) {
    // A token always comes with a profile, so one that finds no one isn't valid (anymore).
    if ('tokenHash' in key) throw new ApiError('unauthorized', UNKNOWN_TOKEN_MESSAGE)
    throw new ApiError('conflict', 'Fill in your profile before you start.')
  }

  // An attempt in progress is returned as it is (ASM-07); a finished one can't be retaken. A
  // school-link student joined while the link was open, so it isn't checked again here.
  const existing = respondent.attempt
  if (existing) {
    if (existing.status !== 'in_progress') throw new ApiError('conflict', ALREADY_TAKEN)
    return reply(existing, 200)
  }

  const picked = pickItems(pool)
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
      // The link they joined through (LNK-05); null online.
      schoolLinkId: respondent.schoolLinkId,
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

/** The attempt with this ID, only if it belongs to the caller's respondent. */
function isOwnAttempt(db: Db | Tx, key: RespondentKey, attemptId: string) {
  return and(
    eq(attempts.id, attemptId),
    inArray(
      attempts.respondentId,
      db.select({ id: respondents.id }).from(respondents).where(respondentIs(key)),
    ),
  )
}

/**
 * When a closed attempt ended. The schema doesn't make submitted_at required, so a row closed some
 * other way (the cron, a fix by hand) may lack it: it closed at expires_at then.
 */
const closedAt = (attempt: { submittedAt: Date | null; expiresAt: Date }) =>
  attempt.submittedAt ?? attempt.expiresAt

/**
 * The caller's attempt with this ID (`isOwnAttempt`). `lock: 'update'` takes a row lock
 * inside the submit's transaction, so no answer lands while it's scored (saveAnswer and saveSus
 * take `for share` in their own single statements).
 */
async function ownAttempt(db: Db | Tx, key: RespondentKey, attemptId: string, lock?: 'update') {
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
    .where(isOwnAttempt(db, key, attemptId))
  const [row] = await (lock ? query.for(lock) : query)
  if (!row) throw new ApiError('not_found', NOT_FOUND)
  return row
}

export const getAttempt: RouteHandler<typeof getAttemptRoute, RespondentEnv> = async (c) => {
  const db = c.var.db
  const attemptId = c.req.valid('param').id

  // All three at once. The items and answers are looked up by the attempt's ID alone and only
  // sent once ownAttempt has found it to be the caller's.
  const [attempt, rows, saved] = await Promise.all([
    ownAttempt(db, c.var.respondentKey, attemptId),
    db
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
      .where(
        inArray(
          questions.id,
          db
            .select({ id: sql`unnest(${attempts.questionOrder})` })
            .from(attempts)
            .where(eq(attempts.id, attemptId)),
        ),
      ),
    db
      .select({ questionId: answers.questionId, choiceId: answers.choiceId })
      .from(answers)
      .where(eq(answers.attemptId, attemptId)),
  ])

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

/** The grace period as an SQL interval, for checks the database makes. */
const grace = sql`make_interval(secs => ${ANSWER_GRACE_SECONDS})`

export const saveAnswer: RouteHandler<typeof saveAnswerRoute, RespondentEnv> = async (c) => {
  const db = c.var.db
  const key = c.var.respondentKey
  const { id, questionId } = c.req.valid('param')
  const { choiceId } = c.req.valid('json')
  const now = new Date()
  const at = sql`${now.toISOString()}::timestamptz`

  // One statement, so one round trip and no transaction: it inserts only if the attempt is the
  // caller's, still open, in time, and the choice is one of this question's in this attempt
  // (choiceOrder holds exactly the attempt's items and each one's own choices). FOR SHARE holds
  // off a submit until the answer is in, and waits for one already scoring, then sees it closed.
  const [saved] = await db
    .insert(answers)
    .select(
      db
        .select({
          attemptId: attempts.id,
          questionId: sql`${questionId}::uuid`.as('question_id'),
          choiceId: sql`${choiceId}::uuid`.as('choice_id'),
          points: sql`null::smallint`.as('points'),
          answeredAt: at.as('answered_at'),
        })
        .from(attempts)
        .where(
          and(
            isOwnAttempt(db, key, id),
            eq(attempts.status, 'in_progress'),
            sql`${attempts.expiresAt} + ${grace} >= ${at}`,
            sql`${attempts.choiceOrder} -> ${questionId}::text @> jsonb_build_array(${choiceId}::text)`,
          ),
        )
        .for('share'),
    )
    .onConflictDoUpdate({
      target: [answers.attemptId, answers.questionId],
      set: { choiceId, answeredAt: now },
    })
    .returning({ answeredAt: answers.answeredAt })

  if (!saved) {
    // Nothing saved: read the attempt again to say why. Only on this rare path.
    const attempt = await ownAttempt(db, key, id)
    if (attempt.status !== 'in_progress') {
      throw new ApiError('conflict', 'This assessment is already closed.')
    }
    if (timeIsUp(attempt.expiresAt, now)) {
      throw new ApiError('conflict', 'Time is up, so this answer wasn’t saved.')
    }
    if (!attempt.choiceOrder[questionId]) {
      throw new ApiError('bad_request', 'This question isn’t part of your assessment.')
    }
    throw new ApiError('bad_request', 'This answer isn’t one of the question’s choices.')
  }

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

export const submitAttempt: RouteHandler<typeof submitAttemptRoute, RespondentEnv> = async (c) => {
  const id = c.req.valid('param').id

  const closed = await c.var.db.transaction(async (tx) => {
    const attempt = await ownAttempt(tx, c.var.respondentKey, id, 'update')
    if (attempt.status === 'voided') {
      throw new ApiError('conflict', VOIDED)
    }
    // Already closed (a second tap, or the timer and the button at once): return it as it is.
    if (attempt.status !== 'in_progress') return attempt
    return scoreAndClose(tx, attempt, new Date())
  })

  // The status is submitted or expired here.
  return c.json(
    {
      id: closed.id,
      status: closed.status as 'submitted' | 'expired',
      submittedAt: closedAt(closed).toISOString(),
    },
    200,
  )
}

// ---- Results ----

export const getResult: RouteHandler<typeof getResultRoute, RespondentEnv> = async (c) => {
  const db = c.var.db
  const attemptId = c.req.valid('param').id

  // Each area with its published lessons, one row per lesson or one with no lesson, fetched
  // alongside the attempt by its ID alone and only used once the attempt is found to be the
  // caller's. At most one published lesson per area and tier (lessons_one_published_per_tier_idx).
  const [[attempt], rows] = await Promise.all([
    db
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
      .leftJoin(susResponses, eq(susResponses.attemptId, attempts.id))
      .where(isOwnAttempt(db, c.var.respondentKey, attemptId)),
    db
      .select({
        areaId: areaResults.areaId,
        area: competencyAreas.code,
        points: areaResults.points,
        maxPoints: areaResults.maxPoints,
        pct: areaResults.pct,
        level: areaResults.level,
        lessonTier: lessons.tier,
        lessonSlug: lessons.slug,
        lessonTitle: lessons.title,
        lessonSummary: lessons.summary,
      })
      .from(areaResults)
      .innerJoin(competencyAreas, eq(competencyAreas.id, areaResults.areaId))
      .leftJoin(lessons, and(eq(lessons.areaId, areaResults.areaId), eq(lessons.isPublished, true)))
      .where(eq(areaResults.attemptId, attemptId))
      .orderBy(competencyAreas.sortOrder),
  ])
  if (!attempt) throw new ApiError('not_found', NOT_FOUND)
  if (attempt.status === 'in_progress') {
    throw new ApiError('conflict', 'Submit the assessment to see your results.')
  }
  if (attempt.status === 'voided') {
    throw new ApiError('conflict', VOIDED)
  }
  const { totalPoints, overallPct, overallLevel } = attempt
  // Submit and the cron always score before closing; a row closed some other way may not be.
  if (totalPoints === null || overallPct === null || overallLevel === null) {
    throw new Error(`Attempt ${attempt.id} is closed but has no scores`)
  }

  type Lesson = { slug: string; title: string; summary: string }
  const byArea = new Map<string, { row: (typeof rows)[number]; lessons: Map<string, Lesson> }>()
  for (const row of rows) {
    let entry = byArea.get(row.areaId)
    if (!entry) {
      entry = { row, lessons: new Map() }
      byArea.set(row.areaId, entry)
    }
    if (row.lessonTier !== null) {
      entry.lessons.set(row.lessonTier, {
        slug: row.lessonSlug!,
        title: row.lessonTitle!,
        summary: row.lessonSummary!,
      })
    }
  }

  // Map keeps insertion order, so the areas stay in sortOrder.
  const areas = [...byArea.values()].map(({ row, lessons: published }) => ({
    // Area codes are the seeded AREA_CODES.
    area: row.area as AreaCode,
    points: row.points,
    maxPoints: row.maxPoints,
    pct: row.pct,
    level: row.level,
    // The level's tiers, the first one to start with (PRD "Levels").
    lessons: LESSON_TIERS_FOR_LEVEL[row.level].map((tier, i) => ({
      tier,
      nextStep: i > 0,
      lesson: published.get(tier) ?? null,
    })),
  }))

  return c.json(
    {
      id: attempt.id,
      status: attempt.status,
      submittedAt: closedAt(attempt).toISOString(),
      overall: {
        points: totalPoints,
        maxPoints: areas.reduce((sum, area) => sum + area.maxPoints, 0),
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

// ---- Usability survey ----

export const saveSus: RouteHandler<typeof saveSusRoute, RespondentEnv> = async (c) => {
  const db = c.var.db
  const key = c.var.respondentKey
  const attemptId = c.req.valid('param').id
  const { answers: given } = c.req.valid('json')
  // The schema checked there are exactly SUS_STATEMENT_COUNT answers, one per column.
  const q = (n: number) => sql`${given[n - 1]!}::smallint`

  // One statement: it inserts only for the caller's finished attempt. FOR SHARE holds off a void
  // until the survey is in, so none lands on a voided attempt. The primary key allows one survey
  // per attempt (SUS-04), so a second one, even sent at the same moment, inserts nothing.
  const [saved] = await db
    .insert(susResponses)
    .select(
      db
        .select({
          attemptId: attempts.id,
          q1: q(1).as('q1'),
          q2: q(2).as('q2'),
          q3: q(3).as('q3'),
          q4: q(4).as('q4'),
          q5: q(5).as('q5'),
          q6: q(6).as('q6'),
          q7: q(7).as('q7'),
          q8: q(8).as('q8'),
          q9: q(9).as('q9'),
          q10: q(10).as('q10'),
          score: sql`${susScore(given)}::numeric`.as('score'),
          submittedAt: sql`now()`.as('submitted_at'),
        })
        .from(attempts)
        .where(
          and(
            isOwnAttempt(db, key, attemptId),
            inArray(attempts.status, FINISHED_ATTEMPT_STATUSES),
          ),
        )
        .for('share'),
    )
    .onConflictDoNothing()
    .returning({
      attemptId: susResponses.attemptId,
      score: susResponses.score,
      submittedAt: susResponses.submittedAt,
    })

  if (!saved) {
    // Nothing saved: read the attempt again to say why. Only on this rare path.
    const attempt = await ownAttempt(db, key, attemptId)
    if (attempt.status === 'in_progress') {
      throw new ApiError('conflict', 'Submit the assessment before you rate DigiBridge.')
    }
    if (attempt.status === 'voided') {
      throw new ApiError('conflict', VOIDED)
    }
    throw new ApiError('already_answered', 'You already rated DigiBridge. Thank you!')
  }

  return c.json(
    {
      attemptId: saved.attemptId,
      score: saved.score,
      submittedAt: saved.submittedAt.toISOString(),
    },
    201,
  )
}
