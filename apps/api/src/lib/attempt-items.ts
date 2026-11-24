import { choices, competencyAreas, questions } from '@digibridge/db'
import { LESSON_TIERS_FOR_LEVEL, type AreaCode, type Level } from '@digibridge/shared'

// What a respondent and a staff preview both see of an attempt: the items in their shuffled order
// without the right answers (RES-05), and the lessons that go with each area's level.

/** One row per choice of each item, as the assessment page needs them. */
export const itemColumns = {
  id: questions.id,
  area: competencyAreas.code,
  stem: questions.stem,
  imageUrl: questions.imageUrl,
  isScenario: questions.isScenario,
  choiceId: choices.id,
  label: choices.label,
}
export type ItemRow = {
  id: string
  area: string
  stem: string
  imageUrl: string | null
  isScenario: boolean
  choiceId: string
  label: string
}

/**
 * The items in the order shown, each with its choices in the order shown (ASM-02). An item or
 * choice missing from `rows` is left out.
 */
export function orderItems(
  questionOrder: readonly string[],
  choiceOrder: Readonly<Record<string, readonly string[]>>,
  rows: readonly ItemRow[],
) {
  const labels = new Map(rows.map((row) => [row.choiceId, row.label]))
  const questionRows = new Map(rows.map((row) => [row.id, row]))
  return questionOrder.flatMap((id) => {
    const row = questionRows.get(id)
    if (!row) return []
    const order = choiceOrder[id] ?? []
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
}

export type LessonLink = { slug: string; title: string; summary: string }

/**
 * The lesson tiers for an area's level, the first one to start with (PRD "Levels"), each with
 * the area's published lesson for that tier (keyed by tier) or null.
 */
export const lessonPicks = (level: Level, published: ReadonlyMap<string, LessonLink>) =>
  LESSON_TIERS_FOR_LEVEL[level].map((tier, i) => ({
    tier,
    nextStep: i > 0,
    lesson: published.get(tier) ?? null,
  }))
