import { answers, attempts, choices, competencyAreas, questions, respondents } from '@digibridge/db'
import { itemFlags, type AreaCode } from '@digibridge/shared'
import type { RouteHandler } from '@hono/zod-openapi'
import { and, asc, count, eq, inArray } from 'drizzle-orm'
import type { AuthEnv } from '../env'
import { dashboardConditions } from '../lib/dashboard-filters'
import type { itemAnalysisRoute } from '../routes/admin-items'

const round2 = (n: number) => Math.round(n * 100) / 100

export const getItemAnalysis: RouteHandler<typeof itemAnalysisRoute, AuthEnv> = async (c) => {
  const db = c.var.db
  // Finished attempts (submitted, or closed by the timer) of respondents who match the filters.
  const finished = and(
    inArray(attempts.status, ['submitted', 'expired']),
    ...dashboardConditions(c.req.valid('query'), attempts.schoolLinkId),
  )

  const [items, itemChoices, shown, picks] = await Promise.all([
    db
      .select({
        questionId: questions.id,
        area: competencyAreas.code,
        difficulty: questions.difficulty,
        stem: questions.stem,
        isActive: questions.isActive,
      })
      .from(questions)
      .innerJoin(competencyAreas, eq(competencyAreas.id, questions.areaId))
      // The difficulty enum is in order: basic, intermediate, advanced.
      .orderBy(competencyAreas.sortOrder, questions.difficulty, questions.createdAt, questions.id),
    db
      .select({
        id: choices.id,
        questionId: choices.questionId,
        label: choices.label,
        isCorrect: choices.isCorrect,
      })
      .from(choices)
      .orderBy(asc(choices.position)),
    // The items each finished attempt showed: 30 IDs each, counted here rather than unnested.
    db
      .select({ questionOrder: attempts.questionOrder })
      .from(attempts)
      .innerJoin(respondents, eq(respondents.id, attempts.respondentId))
      .where(finished),
    db
      .select({ choiceId: answers.choiceId, picked: count() })
      .from(answers)
      .innerJoin(attempts, eq(attempts.id, answers.attemptId))
      .innerJoin(respondents, eq(respondents.id, attempts.respondentId))
      .where(finished)
      .groupBy(answers.choiceId),
  ])

  const seenBy = new Map<string, number>()
  for (const { questionOrder } of shown) {
    for (const id of questionOrder) seenBy.set(id, (seenBy.get(id) ?? 0) + 1)
  }
  const pickedBy = new Map(picks.map((row) => [row.choiceId, row.picked]))
  const choicesBy = new Map<string, typeof itemChoices>()
  for (const choice of itemChoices) {
    choicesBy.set(choice.questionId, [...(choicesBy.get(choice.questionId) ?? []), choice])
  }

  return c.json(
    {
      items: items.map((item) => {
        const seen = seenBy.get(item.questionId) ?? 0
        const counted = (choicesBy.get(item.questionId) ?? []).map(
          ({ questionId: _q, ...choice }) => ({
            ...choice,
            picked: pickedBy.get(choice.id) ?? 0,
          }),
        )
        const answered = counted.reduce((sum, choice) => sum + choice.picked, 0)
        const correct = counted.find((choice) => choice.isCorrect)?.picked ?? 0
        return {
          ...item,
          // Area codes are the seeded AREA_CODES.
          area: item.area as AreaCode,
          seen,
          correct,
          correctPct: seen === 0 ? null : round2((correct * 100) / seen),
          blank: Math.max(seen - answered, 0),
          choices: counted,
          flags: itemFlags({ seen, correct, choices: counted }),
        }
      }),
    },
    200,
  )
}
