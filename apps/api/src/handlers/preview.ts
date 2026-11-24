import { choices, competencyAreas, lessons, questions } from '@digibridge/db'
import { ATTEMPT_DURATION_MINUTES, type AreaCode, type Difficulty } from '@digibridge/shared'
import type { RouteHandler } from '@hono/zod-openapi'
import { eq, inArray } from 'drizzle-orm'
import type { AuthEnv } from '../env'
import {
  itemColumns,
  lessonPicks,
  orderItems,
  type ItemRow,
  type LessonLink,
} from '../lib/attempt-items'
import { pickItems, type PoolItem } from '../lib/pick-items'
import { roundPct, scoreAttempt, type ScoredItem } from '../lib/scoring'
import { ApiError } from '../middleware'
import type { previewResultRoute, startPreviewRoute } from '../routes/preview'

// The staff preview: a sample assessment and its result, worked out the way a respondent's are
// but never saved, so staff tries stay out of the research data.

const NOT_READY = 'The assessment isn’t ready yet. Add more active questions first.'

export const startPreview: RouteHandler<typeof startPreviewRoute, AuthEnv> = async (c) => {
  // The pool with everything the page shows, in one query: nothing is saved, so the picked items
  // can't go stale between reading and inserting as a real start's can.
  const rows: (ItemRow & { difficulty: Difficulty })[] = await c.var.db
    .select({ ...itemColumns, difficulty: questions.difficulty })
    .from(questions)
    .innerJoin(competencyAreas, eq(competencyAreas.id, questions.areaId))
    .innerJoin(choices, eq(choices.questionId, questions.id))
    .where(eq(questions.isActive, true))

  const pool = new Map<string, PoolItem & { choiceIds: string[] }>()
  for (const row of rows) {
    const item = pool.get(row.id)
    if (item) item.choiceIds.push(row.choiceId)
    else {
      pool.set(row.id, {
        id: row.id,
        // Area codes are the seeded AREA_CODES; an unknown one simply never gets picked.
        area: row.area as AreaCode,
        difficulty: row.difficulty,
        choiceIds: [row.choiceId],
      })
    }
  }

  const picked = pickItems([...pool.values()])
  if (!picked.ok) throw new ApiError('conflict', NOT_READY)

  const startedAt = new Date()
  const expiresAt = new Date(startedAt.getTime() + ATTEMPT_DURATION_MINUTES * 60_000)
  return c.json(
    {
      id: crypto.randomUUID(),
      status: 'in_progress' as const,
      startedAt: startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      serverTime: startedAt.toISOString(),
      items: orderItems(picked.questionOrder, picked.choiceOrder, rows),
      answers: [],
    },
    201,
  )
}

export const previewResult: RouteHandler<typeof previewResultRoute, AuthEnv> = async (c) => {
  const db = c.var.db
  const body = c.req.valid('json')

  // The questions with their choices, and every published lesson, at once.
  const [rows, published] = await Promise.all([
    db
      .select({
        id: questions.id,
        area: competencyAreas.code,
        difficulty: questions.difficulty,
        choiceId: choices.id,
        isCorrect: choices.isCorrect,
      })
      .from(questions)
      .innerJoin(competencyAreas, eq(competencyAreas.id, questions.areaId))
      .innerJoin(choices, eq(choices.questionId, questions.id))
      .where(inArray(questions.id, body.questionIds)),
    db
      .select({
        area: competencyAreas.code,
        tier: lessons.tier,
        slug: lessons.slug,
        title: lessons.title,
        summary: lessons.summary,
      })
      .from(lessons)
      .innerJoin(competencyAreas, eq(competencyAreas.id, lessons.areaId))
      .where(eq(lessons.isPublished, true)),
  ])

  const byId = new Map<string, ScoredItem & { choiceIds: Set<string> }>()
  for (const row of rows) {
    let item = byId.get(row.id)
    if (!item) {
      item = {
        questionId: row.id,
        // Area codes are the seeded AREA_CODES.
        area: row.area as AreaCode,
        difficulty: row.difficulty,
        correctChoiceId: null,
        choiceIds: new Set(),
      }
      byId.set(row.id, item)
    }
    item.choiceIds.add(row.choiceId)
    if (row.isCorrect) item.correctChoiceId = row.choiceId
  }
  if (byId.size !== body.questionIds.length) {
    throw new ApiError('conflict', 'A question was deleted. Start the preview again.')
  }
  for (const answer of body.answers) {
    if (!byId.get(answer.questionId)?.choiceIds.has(answer.choiceId)) {
      throw new ApiError('bad_request', 'An answer isn’t one of its question’s choices.')
    }
  }

  const score = scoreAttempt(
    body.questionIds.map((id) => byId.get(id)!),
    new Map(body.answers.map((a) => [a.questionId, a.choiceId])),
  )

  const lessonsByArea = new Map<string, Map<string, LessonLink>>()
  for (const { area, tier, ...lesson } of published) {
    const tiers = lessonsByArea.get(area) ?? new Map<string, LessonLink>()
    tiers.set(tier, lesson)
    lessonsByArea.set(area, tiers)
  }

  return c.json(
    {
      id: body.id,
      status: body.timeUp ? ('expired' as const) : ('submitted' as const),
      submittedAt: new Date().toISOString(),
      overall: { ...score.overall, pct: roundPct(score.overall.pct) },
      areas: score.areas.map((area) => ({
        ...area,
        pct: roundPct(area.pct),
        lessons: lessonPicks(area.level, lessonsByArea.get(area.area) ?? new Map()),
      })),
      resultsToken: null,
      susAnswered: false,
    },
    200,
  )
}
