import { attempts, choices, competencyAreas, questions, respondents } from '@digibridge/db'
import { ATTEMPT_DURATION_MINUTES, type AreaCode, type AttemptStatus } from '@digibridge/shared'
import type { RouteHandler } from '@hono/zod-openapi'
import { and, eq, ne } from 'drizzle-orm'
import type { Db } from '../config/db'
import type { AuthEnv } from '../env'
import { pickItems, type PoolItem } from '../lib/pick-items'
import { ApiError } from '../middleware'
import type { startAttemptRoute } from '../routes/attempts'

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
