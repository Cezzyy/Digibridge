import { attempts, choices, competencyAreas, questions } from '@digibridge/db'
import { correctChoiceIndex, type AreaCode } from '@digibridge/shared'
import type { RouteHandler } from '@hono/zod-openapi'
import { and, asc, eq, sql } from 'drizzle-orm'
import type { Db } from '../config/db'
import type { AuthEnv } from '../env'
import { areaIdOf } from '../lib/area-id'
import type { Tx } from '../lib/close-attempt'
import { notNullViolation } from '../lib/pg-errors'
import { ApiError } from '../middleware'
import type {
  createQuestionRoute,
  deleteQuestionRoute,
  getAdminQuestionRoute,
  listAdminQuestionsRoute,
  updateQuestionRoute,
} from '../routes/admin-questions'

// The questions editor (CMS-01 to CMS-03). Admin only.
//
// Scoring reads a question's area, difficulty and right choice when an attempt is submitted
// (lib/close-attempt.ts), so once any attempt has shown it they're locked (CMS-02): changing them
// would change what that attempt's answers are worth. Voided attempts count too: their answers and
// scores stay for the record. An edit or delete locks the question row FOR UPDATE, then checks.
// A start locks the questions it picked FOR SHARE as its attempt goes in (lib/start-attempt.ts),
// so the two take turns: the check must run in a statement after the lock, because a statement
// sees the database as it was when the statement began, and would miss an attempt that went in
// while it waited.

const NOT_FOUND = 'We couldn’t find this question. Someone may have deleted it.'
const AREA_MISSING = 'This area isn’t set up yet.'

/**
 * Whether any attempt has shown the question: its ID is in the attempt's question_order. The
 * table is named outright: in a query on questions alone Drizzle writes `"id"` bare, which inside
 * this subquery would mean attempts.id.
 */
const shown = sql<boolean>`exists (select 1 from ${attempts} where ${questions}.${sql.identifier(questions.id.name)} = any(${attempts.questionOrder}))`

const summaryColumns = {
  id: questions.id,
  area: competencyAreas.code,
  difficulty: questions.difficulty,
  stem: questions.stem,
  imageUrl: questions.imageUrl,
  isScenario: questions.isScenario,
  isActive: questions.isActive,
  shown,
  updatedAt: questions.updatedAt,
}

/** What a save returns from the questions table: every column the editor shows but the area. */
const savedColumns = {
  id: questions.id,
  difficulty: questions.difficulty,
  stem: questions.stem,
  imageUrl: questions.imageUrl,
  isScenario: questions.isScenario,
  isActive: questions.isActive,
  explanation: questions.explanation,
  updatedAt: questions.updatedAt,
}

const choiceColumns = { id: choices.id, label: choices.label, isCorrect: choices.isCorrect }
type Choice = { id: string; label: string; isCorrect: boolean }

// Area codes are the seeded AREA_CODES.
const toJson = <T extends { area: string; updatedAt: Date }>({
  area,
  updatedAt,
  ...question
}: T) => ({
  ...question,
  area: area as AreaCode,
  updatedAt: updatedAt.toISOString(),
})

/** Turns a save into a 404 when its area was never seeded. */
async function saving<T>(save: () => Promise<T>): Promise<T> {
  try {
    return await save()
  } catch (err) {
    if (notNullViolation(err) === 'area_id') throw new ApiError('not_found', AREA_MISSING)
    throw err
  }
}

/** A question's choices in position order. */
const choicesOf = (db: Db | Tx, questionId: string) =>
  db
    .select(choiceColumns)
    .from(choices)
    .where(eq(choices.questionId, questionId))
    .orderBy(asc(choices.position))

/**
 * Writes the choices at positions 0 to 3, keeping each one's ID, so answers already given still
 * point at the same choice. When the right one moves, the old one is cleared first: the
 * one-correct index is checked row by row, so setting both in one statement could trip it.
 */
async function writeChoices(
  tx: Tx,
  questionId: string,
  next: readonly { label: string; isCorrect: boolean }[],
  moved: boolean,
): Promise<Choice[]> {
  if (moved) {
    await tx
      .update(choices)
      .set({ isCorrect: false })
      .where(and(eq(choices.questionId, questionId), eq(choices.isCorrect, true)))
  }
  const rows = await tx
    .insert(choices)
    .values(next.map((choice, position) => ({ ...choice, questionId, position })))
    .onConflictDoUpdate({
      target: [choices.questionId, choices.position],
      set: { label: sql`excluded.label`, isCorrect: sql`excluded.is_correct` },
    })
    .returning({ ...choiceColumns, position: choices.position })
  return rows.sort((a, b) => a.position - b.position).map(({ position: _p, ...choice }) => choice)
}

export const listAdminQuestions: RouteHandler<typeof listAdminQuestionsRoute, AuthEnv> = async (
  c,
) => {
  const rows = await c.var.db
    .select(summaryColumns)
    .from(questions)
    .innerJoin(competencyAreas, eq(competencyAreas.id, questions.areaId))
    // The difficulty enum is in order: basic, intermediate, advanced.
    .orderBy(competencyAreas.sortOrder, questions.difficulty, questions.createdAt, questions.id)
  return c.json({ questions: rows.map(toJson) }, 200)
}

export const getAdminQuestion: RouteHandler<typeof getAdminQuestionRoute, AuthEnv> = async (c) => {
  const db = c.var.db
  const { id } = c.req.valid('param')
  const [[question], questionChoices] = await Promise.all([
    db
      .select({ ...summaryColumns, explanation: questions.explanation })
      .from(questions)
      .innerJoin(competencyAreas, eq(competencyAreas.id, questions.areaId))
      .where(eq(questions.id, id)),
    choicesOf(db, id),
  ])
  if (!question) throw new ApiError('not_found', NOT_FOUND)
  return c.json(toJson({ ...question, choices: questionChoices }), 200)
}

export const createQuestion: RouteHandler<typeof createQuestionRoute, AuthEnv> = async (c) => {
  const { area, choices: newChoices, ...question } = c.req.valid('json')
  const created = await saving(() =>
    c.var.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(questions)
        .values({ ...question, areaId: areaIdOf(area), createdBy: c.var.profile.id })
        .returning(savedColumns)
      return { ...row!, choices: await writeChoices(tx, row!.id, newChoices, false) }
    }),
  )
  return c.json(toJson({ ...created, area, shown: false }), 201)
}

export const updateQuestion: RouteHandler<typeof updateQuestionRoute, AuthEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const { area: newArea, choices: newChoices, ...changes } = c.req.valid('json')

  const updated = await saving(() =>
    c.var.db.transaction(async (tx) => {
      // Locked, so a delete, another edit or a start that picked this question waits for this one.
      const [current] = await tx
        .select({
          areaId: questions.areaId,
          area: competencyAreas.code,
          difficulty: questions.difficulty,
        })
        .from(questions)
        .innerJoin(competencyAreas, eq(competencyAreas.id, questions.areaId))
        .where(eq(questions.id, id))
        .for('update', { of: questions })
      if (!current) throw new ApiError('not_found', NOT_FOUND)
      // Read once the lock is held (see the top of this file).
      const [[seen], currentChoices] = await Promise.all([
        tx.select({ shown }).from(questions).where(eq(questions.id, id)),
        choicesOf(tx, id),
      ])
      const isShown = seen!.shown

      const area = newArea ?? (current.area as AreaCode)
      const moved =
        newChoices !== undefined &&
        correctChoiceIndex(newChoices) !== correctChoiceIndex(currentChoices)
      if (
        isShown &&
        (area !== current.area ||
          (changes.difficulty !== undefined && changes.difficulty !== current.difficulty) ||
          moved)
      ) {
        throw new ApiError(
          'conflict',
          'Students have already seen this question, so its area, difficulty and right answer can’t change. Make it inactive and add a new one instead.',
        )
      }

      const [row] = await tx
        .update(questions)
        // areaId is always set, so even an empty change bumps updatedAt.
        .set({ ...changes, areaId: area === current.area ? current.areaId : areaIdOf(area) })
        .where(eq(questions.id, id))
        .returning(savedColumns)
      const savedChoices = newChoices
        ? await writeChoices(tx, id, newChoices, moved)
        : currentChoices
      return { ...row!, area, shown: isShown, choices: savedChoices }
    }),
  )
  return c.json(toJson(updated), 200)
}

export const deleteQuestion: RouteHandler<typeof deleteQuestionRoute, AuthEnv> = async (c) => {
  const { id } = c.req.valid('param')
  await c.var.db.transaction(async (tx) => {
    // Locked first, then checked in a statement of its own (see the top of this file).
    const [question] = await tx
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.id, id))
      .for('update')
    if (!question) throw new ApiError('not_found', NOT_FOUND)
    // Its choices go with it (on delete cascade).
    const [deleted] = await tx
      .delete(questions)
      .where(and(eq(questions.id, id), sql`not ${shown}`))
      .returning({ id: questions.id })
    if (!deleted) {
      throw new ApiError(
        'conflict',
        'Students have already seen this question, so it can’t be deleted. Make it inactive instead.',
      )
    }
  })
  return c.body(null, 204)
}
