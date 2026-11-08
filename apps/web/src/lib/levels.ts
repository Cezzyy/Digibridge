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

/** A level's range in words: "Below 40%", "40% to 59%", "80% and up". */
export function levelRange(band: { from: number; to: number }) {
  if (band.from === 0) return `Below ${band.to}%`
  if (band.to === 100) return `${band.from}% and up`
  return `${band.from}% to ${band.to - 1}%`
}

/**
 * A score as a whole percentage, rounded down, so it never looks like a level it didn't reach:
 * 79.6% shows as 79%, which is still Intermediate. Levels come from the unrounded score.
 */
export const wholePct = (pct: number) => Math.floor(pct)
