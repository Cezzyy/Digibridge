import { LEVEL_CUTOFFS, type Level } from '@digibridge/shared'

/** Background and text classes for each level (docs/design.md, "Levels"). */
export const LEVEL_TONE = {
  beginner: 'bg-level-1 text-ink',
  basic: 'bg-level-2 text-ink',
  intermediate: 'bg-level-3 text-white',
  advanced: 'bg-level-4 text-white',
} as const satisfies Record<Level, string>

/** The 4 levels as score ranges (0 to 100), lowest first. */
export const LEVEL_BANDS: readonly { level: Level; from: number; to: number }[] = LEVEL_CUTOFFS.map(
  (cutoff, i) => ({ level: cutoff.level, from: cutoff.min, to: LEVEL_CUTOFFS[i - 1]?.min ?? 100 }),
).reverse()
