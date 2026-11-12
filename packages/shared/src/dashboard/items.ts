import { z } from 'zod'

// Item analysis (DSH-08): for each question, the share of respondents who saw it and got it
// right (its difficulty index), and how often each choice was picked, to spot items that are too
// easy, too hard or confusing. Counts finished attempts only.

/** At or above this percent correct, an item is too easy. */
export const ITEM_EASY_MIN_PCT = 90
/** Below this percent correct, an item is too hard. */
export const ITEM_HARD_BELOW_PCT = 20
/** An item gets no flags until this many finished attempts have shown it. */
export const ITEM_FLAG_MIN_SEEN = 5

export const ITEM_FLAGS = ['too_easy', 'too_hard', 'confusing'] as const
export const itemFlagSchema = z.enum(ITEM_FLAGS)
export type ItemFlag = (typeof ITEM_FLAGS)[number]

export const ITEM_FLAG_LABELS = {
  too_easy: 'Too easy',
  too_hard: 'Too hard',
  confusing: 'Confusing',
} as const satisfies Record<ItemFlag, string>

export const ITEM_FLAG_DESCRIPTIONS = {
  too_easy: `${ITEM_EASY_MIN_PCT}% or more got it right.`,
  too_hard: `Fewer than ${ITEM_HARD_BELOW_PCT}% got it right.`,
  confusing: 'A wrong choice was picked more often than the right one.',
} as const satisfies Record<ItemFlag, string>

/**
 * An item's flags from how many saw it, how many got it right, and how often each choice was
 * picked. None until ITEM_FLAG_MIN_SEEN have seen it.
 */
export function itemFlags(item: {
  seen: number
  correct: number
  choices: readonly { isCorrect: boolean; picked: number }[]
}): ItemFlag[] {
  if (item.seen < ITEM_FLAG_MIN_SEEN) return []
  const flags: ItemFlag[] = []
  const pct = (item.correct * 100) / item.seen
  if (pct >= ITEM_EASY_MIN_PCT) flags.push('too_easy')
  if (pct < ITEM_HARD_BELOW_PCT) flags.push('too_hard')
  const right = item.choices.find((choice) => choice.isCorrect)?.picked ?? 0
  if (item.choices.some((choice) => !choice.isCorrect && choice.picked > right)) {
    flags.push('confusing')
  }
  return flags
}
