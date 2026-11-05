import { AREA_CODES, ITEMS_PER_DIFFICULTY } from './assessment'
import type { Difficulty, LessonTier, Level } from './enums'

// Scoring weights, level cut-offs and lesson recommendations (PRD "Assessment and scoring rules").

/** Points for a correct answer. A wrong or unanswered item earns 0. */
export const POINTS_PER_DIFFICULTY = {
  basic: 1,
  intermediate: 2,
  advanced: 3,
} as const satisfies Record<Difficulty, number>

/** 18 points per area: 4 × 1 + 4 × 2 + 2 × 3. */
export const AREA_MAX_POINTS = (Object.keys(ITEMS_PER_DIFFICULTY) as Difficulty[]).reduce(
  (sum, d) => sum + ITEMS_PER_DIFFICULTY[d] * POINTS_PER_DIFFICULTY[d],
  0,
)

/** 54 points across the 3 areas. */
export const OVERALL_MAX_POINTS = AREA_MAX_POINTS * AREA_CODES.length

/** Lowest percentage for each level, highest first. Used for each area and the overall score. */
export const LEVEL_CUTOFFS = [
  { min: 80, level: 'advanced' },
  { min: 60, level: 'intermediate' },
  { min: 40, level: 'basic' },
  { min: 0, level: 'beginner' },
] as const satisfies readonly { min: number; level: Level }[]

/** Level for a percentage from 0 to 100. Pass the unrounded percentage. */
export const levelForPct = (pct: number): Level =>
  LEVEL_CUTOFFS.find((cutoff) => pct >= cutoff.min)?.level ?? 'beginner'

/** Lesson tiers recommended for a level in an area; the second one is the next step. */
export const LESSON_TIERS_FOR_LEVEL = {
  beginner: ['foundations'],
  basic: ['foundations', 'intermediate'],
  intermediate: ['intermediate', 'advanced'],
  advanced: ['advanced'],
} as const satisfies Record<Level, readonly LessonTier[]>
