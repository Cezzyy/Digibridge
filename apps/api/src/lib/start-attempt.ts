import {
  attempts,
  attemptStatusEnum,
  choices,
  competencyAreas,
  questions,
  respondents,
} from '@digibridge/db'
import type { AreaCode, AttemptStatus } from '@digibridge/shared'
import { and, eq, or, sql } from 'drizzle-orm'
import type { Db } from '../config/db'
import type { RespondentKey } from '../env'
import type { PickedItems, PoolItem } from './pick-items'
import { notNullViolation } from './pg-errors'
import { respondentIs } from './respondent'

// Reading the item pool and saving a new attempt (POST /attempts, TRD "Assessment engine").

export const attemptSummaryColumns = {
  id: attempts.id,
  status: attempts.status,
  startedAt: attempts.startedAt,
  expiresAt: attempts.expiresAt,
}
export type AttemptSummary = { id: string; status: AttemptStatus; startedAt: Date; expiresAt: Date }

/** Active questions with their choices, as the pool for a new attempt. */
export async function activePool(db: Db): Promise<PoolItem[]> {
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

/**
 * What an insert came to: the new attempt; `taken` when the respondent already has one that
 * isn't voided; `stale` when a picked question changed after the pool was read; `no_respondent`
 * when the caller's key no longer finds the respondent.
 */
export type InsertedAttempt = AttemptSummary | 'taken' | 'stale' | 'no_respondent'

/**
 * Saves a new attempt with the picked items, in one statement.
 *
 * The pool was read in an earlier query, so the questions editor may have changed a picked
 * question since. The insert locks the picked questions FOR SHARE and checks each is still
 * active, in its area and at its difficulty; if one isn't, nothing goes in (`stale`), and the
 * caller picks again. An edit or delete locks the question FOR UPDATE, so the two take turns:
 * an edit that commits first is seen here, and one that comes second waits until this attempt
 * is in, then sees the question as shown (CMS-02).
 */
export async function insertAttempt(
  db: Db,
  args: {
    respondentId: string
    key: RespondentKey
    picked: Extract<PickedItems, { ok: true }>
    startedAt: Date
    expiresAt: Date
  },
): Promise<InsertedAttempt> {
  const { respondentId, key, picked, startedAt, expiresAt } = args

  // The respondent is read again as the row goes in, under FOR SHARE. A rejoin through a link
  // locks this row before it checks for attempts, then gives it a new token and maybe a new link:
  // it either waits for this start (and then refuses), or goes first, and then the row no longer
  // matches the caller's key, so respondent_id comes out null and nothing goes in.
  const me = db.$with('me').as(
    db
      .select({ id: respondents.id, schoolLinkId: respondents.schoolLinkId })
      .from(respondents)
      .where(and(eq(respondents.id, respondentId), respondentIs(key)))
      .for('share'),
  )
  // The picked questions that are still as they were picked. FOR SHARE waits for an edit in
  // progress and then reads the question as it was saved, so an edit that commits first drops it.
  const unchanged = db.$with('unchanged').as(
    db
      .select({ id: questions.id })
      .from(questions)
      .innerJoin(competencyAreas, eq(competencyAreas.id, questions.areaId))
      .where(
        and(
          eq(questions.isActive, true),
          or(
            ...picked.items.map((item) =>
              and(
                eq(questions.id, item.id),
                eq(competencyAreas.code, item.area),
                eq(questions.difficulty, item.difficulty),
              ),
            ),
          ),
        ),
      )
      .for('share', { of: questions }),
  )

  try {
    // The partial unique index allows one attempt per respondent that isn't voided, so a second
    // start sent at the same moment inserts nothing and gets the first one's attempt.
    const [created] = await db
      .with(me, unchanged)
      .insert(attempts)
      .values({
        respondentId: sql`(select ${me.id} from ${me})`,
        // The link they joined through (LNK-05); null online.
        schoolLinkId: sql`(select ${me.schoolLinkId} from ${me})`,
        // Null, so the insert fails on NOT NULL, unless every picked question is unchanged.
        status: sql`case when (select count(*) from ${unchanged}) = ${picked.items.length}
          then 'in_progress'::${sql.raw(attemptStatusEnum.enumName)} end`,
        startedAt,
        expiresAt,
        questionOrder: picked.questionOrder,
        choiceOrder: picked.choiceOrder,
      })
      .onConflictDoNothing()
      .returning(attemptSummaryColumns)
    return created ?? 'taken'
  } catch (err) {
    // respondent_id comes before status, so a missing respondent is reported first.
    const column = notNullViolation(err)
    if (column === 'respondent_id') return 'no_respondent'
    if (column === 'status') return 'stale'
    throw err
  }
}
