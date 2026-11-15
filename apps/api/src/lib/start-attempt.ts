import { attempts, choices, competencyAreas, questions, respondents } from '@digibridge/db'
import type { AreaCode, AttemptStatus } from '@digibridge/shared'
import { and, eq, or, sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import type { Db } from '../config/db'
import type { RespondentKey } from '../env'
import type { PickedItems, PoolItem } from './pick-items'
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
  // matches the caller's key, so `me` is empty and nothing goes in.
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

  // The values to insert, each in its column's own encoding and cast to its type, since they
  // ride in a SELECT. `respondent_id` and `school_link_id` (LNK-05; null online) come from `me`.
  const columns = [
    attempts.startedAt,
    attempts.expiresAt,
    attempts.questionOrder,
    attempts.choiceOrder,
  ]
  const values = [startedAt, expiresAt, picked.questionOrder, picked.choiceOrder]
  const cast = (column: AnyPgColumn, v: unknown) =>
    sql`${sql.param(v, column)}::${sql.raw(column.getSQLType())}`
  const name = (column: AnyPgColumn) => sql.identifier(column.name)

  // INSERT … SELECT FROM me, so no row goes in when `me` finds no one or a picked question
  // changed, and a stale pick is a result, not an error. The partial unique index allows one
  // attempt per respondent that isn't voided, so a second start sent at the same moment inserts
  // nothing too, and gets the first one's attempt. Drizzle's own insert-select must list every
  // column in table order, so this one is written out.
  const created = db.$with('created', attemptSummaryColumns).as(sql`
    insert into ${attempts}
      (${sql.join([attempts.respondentId, attempts.schoolLinkId, ...columns].map(name), sql`, `)})
    select ${me.id}, ${me.schoolLinkId}, ${sql.join(
      columns.map((column, i) => cast(column, values[i])),
      sql`, `,
    )}
    from ${me}
    where (select count(*) from ${unchanged}) = ${picked.items.length}
    on conflict do nothing
    returning ${sql.join(Object.values(attemptSummaryColumns).map(name), sql`, `)}
  `)

  // Which of the outcomes it was, read in the same statement: no row when `me` finds no one,
  // else the new attempt, or how many picked questions were unchanged when nothing went in.
  const [row] = await db
    .with(me, unchanged, created)
    .select({
      unchanged: sql<number>`(select count(*) from ${unchanged})::int`,
      id: created.id,
      status: created.status,
      startedAt: created.startedAt,
      expiresAt: created.expiresAt,
    })
    .from(me)
    .leftJoin(created, sql`true`)
  if (!row) return 'no_respondent'
  const { unchanged: fresh, ...attempt } = row
  if (attempt.id !== null) return attempt as AttemptSummary
  return fresh === picked.items.length ? 'taken' : 'stale'
}
