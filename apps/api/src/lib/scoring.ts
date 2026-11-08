import {
  AREA_CODES,
  levelForPct,
  POINTS_PER_DIFFICULTY,
  type AreaCode,
  type Difficulty,
  type Level,
} from '@digibridge/shared'

// Scores a finished attempt (PRD "Assessment and scoring rules", TRD "Scoring"). Pure, so the
// submit handler and the cron can share it and the unit tests need no database.

/** One item of the attempt, with its right answer. `correctChoiceId` is null if it has none. */
export type ScoredItem = {
  questionId: string
  area: AreaCode
  difficulty: Difficulty
  correctChoiceId: string | null
}

/** Points earned out of the most possible, as an unrounded percentage and its level. */
export type Score = { points: number; maxPoints: number; pct: number; level: Level }

export type AttemptScore = {
  /** Points for each answered item, by question ID: its weight if right, else 0. */
  answerPoints: Map<string, number>
  /** One score per area that has items, in AREA_CODES order. */
  areas: (Score & { area: AreaCode })[]
  overall: Score
}

function toScore(points: number, maxPoints: number): Score {
  const pct = maxPoints === 0 ? 0 : (points / maxPoints) * 100
  return { points, maxPoints, pct, level: levelForPct(pct) }
}

/**
 * Scores the items against the saved answers (question ID -> choice ID). A right answer earns
 * its difficulty's points; a wrong or missing one earns 0. Answers to questions that aren't in
 * `items` are ignored.
 */
export function scoreAttempt(
  items: readonly ScoredItem[],
  answers: ReadonlyMap<string, string>,
): AttemptScore {
  const answerPoints = new Map<string, number>()
  const byArea = new Map<AreaCode, { points: number; maxPoints: number }>()

  for (const item of items) {
    const weight = POINTS_PER_DIFFICULTY[item.difficulty]
    const chosen = answers.get(item.questionId)
    const earned = chosen !== undefined && chosen === item.correctChoiceId ? weight : 0
    if (chosen !== undefined) answerPoints.set(item.questionId, earned)

    const area = byArea.get(item.area) ?? { points: 0, maxPoints: 0 }
    area.points += earned
    area.maxPoints += weight
    byArea.set(item.area, area)
  }

  const areas = AREA_CODES.flatMap((area) => {
    const total = byArea.get(area)
    return total ? [{ area, ...toScore(total.points, total.maxPoints) }] : []
  })
  const points = areas.reduce((sum, a) => sum + a.points, 0)
  const maxPoints = areas.reduce((sum, a) => sum + a.maxPoints, 0)
  return { answerPoints, areas, overall: toScore(points, maxPoints) }
}

/** A percentage rounded to 2 decimals, for the numeric(5, 2) columns. */
export const roundPct = (pct: number) => Math.round(pct * 100) / 100
