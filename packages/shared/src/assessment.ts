import type { Difficulty } from './enums'

// Rules of one assessment attempt (ASM-01, ASM-03, ASM-09, CMS-07).

/** Codes of the 3 DigComp 2.2 areas, matching `competency_areas.code`. */
export const AREA_CODES = ['info_literacy', 'communication', 'safety'] as const
export type AreaCode = (typeof AREA_CODES)[number]

/** Items picked per area for each difficulty: 4 basic, 4 intermediate, 2 advanced. */
export const ITEMS_PER_DIFFICULTY = {
  basic: 4,
  intermediate: 4,
  advanced: 2,
} as const satisfies Record<Difficulty, number>

/** 10 items per area. */
export const ITEMS_PER_AREA = Object.values(ITEMS_PER_DIFFICULTY).reduce((sum, n) => sum + n, 0)

/** 30 items in an attempt. */
export const ITEMS_PER_ATTEMPT = ITEMS_PER_AREA * AREA_CODES.length

/** At least this many of each area's items are scenario items with an image. */
export const MIN_SCENARIO_ITEMS_PER_AREA = 3

export const CHOICES_PER_QUESTION = 4

/** Time allowed from the start of an attempt. */
export const ATTEMPT_DURATION_MINUTES = 25

/** Answers still in flight are accepted this long after `expires_at`. */
export const ANSWER_GRACE_SECONDS = 30
