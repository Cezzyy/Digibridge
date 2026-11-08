import { answers, areaResults, attempts, choices, competencyAreas, questions } from '@digibridge/db'
import { ANSWER_GRACE_SECONDS, type AreaCode } from '@digibridge/shared'
import { and, eq, inArray, lt, sql } from 'drizzle-orm'
import type { Db } from '../config/db'
import { roundPct, scoreAttempt, type ScoredItem } from './scoring'

// Closing an attempt: submit (handlers/attempts.ts) and the cron (index.ts) both end here.

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

/** Answers are taken until `expires_at` plus the grace period, for saves already in flight. */
export const timeIsUp = (expiresAt: Date, now: Date) =>
  now.getTime() > expiresAt.getTime() + ANSWER_GRACE_SECONDS * 1000

/**
 * Scores the attempt and closes it, in the caller's transaction, which must hold the attempt
 * row locked `for update`. Writes each answer's points, one `area_results` row per area and the
 * overall score and level.
 */
export async function scoreAndClose(
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
  // expired, at expires_at.
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

/**
 * The cron's job: scores and closes, as `expired`, every attempt still in progress more than the
 * grace period past `expires_at` (the tab was closed or the phone died before it submitted).
 * Each attempt gets its own transaction, so one failure doesn't hold up the rest; one that a
 * submit has locked is skipped, since that submit closes it. Returns how many it closed.
 */
export async function closeExpiredAttempts(db: Db, now = new Date()) {
  const cutoff = new Date(now.getTime() - ANSWER_GRACE_SECONDS * 1000)
  const due = await db
    .select({ id: attempts.id })
    .from(attempts)
    .where(and(eq(attempts.status, 'in_progress'), lt(attempts.expiresAt, cutoff)))

  let closed = 0
  for (const { id } of due) {
    try {
      const done = await db.transaction(async (tx) => {
        const [attempt] = await tx
          .select({
            id: attempts.id,
            status: attempts.status,
            expiresAt: attempts.expiresAt,
            questionOrder: attempts.questionOrder,
          })
          .from(attempts)
          .where(eq(attempts.id, id))
          .for('update', { skipLocked: true })
        // Locked by a submit, or closed since the first query.
        if (attempt?.status !== 'in_progress') return false
        await scoreAndClose(tx, attempt, now)
        return true
      })
      if (done) closed++
    } catch (error) {
      console.error(`Couldn't close expired attempt ${id}`, error)
    }
  }
  return closed
}
