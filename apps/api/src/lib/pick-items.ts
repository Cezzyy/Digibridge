import {
  AREA_CODES,
  CHOICES_PER_QUESTION,
  DIFFICULTIES,
  ITEMS_PER_DIFFICULTY,
  type AreaCode,
  type Difficulty,
} from '@digibridge/shared'
import { shuffle } from './shuffle'

// Picks and orders the items of a new attempt (ASM-01, ASM-02, TRD "Assessment engine").

/** An active question that could go into an attempt, with its choices' IDs. */
export type PoolItem = {
  id: string
  area: AreaCode
  difficulty: Difficulty
  choiceIds: readonly string[]
}

/** An area and difficulty with too few usable items, for the log. */
export type Shortfall = { area: AreaCode; difficulty: Difficulty; have: number; need: number }

export type PickedItems =
  | {
      ok: true
      /** The picked items in the order shown. */
      items: PoolItem[]
      /** Question IDs in the order shown. */
      questionOrder: string[]
      /** Question ID -> its choice IDs in the order shown. */
      choiceOrder: Record<string, string[]>
    }
  | { ok: false; shortfalls: Shortfall[] }

/**
 * Takes ITEMS_PER_DIFFICULTY items of each difficulty from each area (4, 4 and 2), picked at
 * random when there are more, then shuffles all of them together and each item's choices.
 * Items without exactly CHOICES_PER_QUESTION choices are skipped. `ok: false` lists every area
 * and difficulty that has too few items, so nothing is picked.
 */
export function pickItems(pool: readonly PoolItem[]): PickedItems {
  const usable = pool.filter((item) => item.choiceIds.length === CHOICES_PER_QUESTION)
  const picked: PoolItem[] = []
  const shortfalls: Shortfall[] = []

  for (const area of AREA_CODES) {
    for (const difficulty of DIFFICULTIES) {
      const need = ITEMS_PER_DIFFICULTY[difficulty]
      const candidates = usable.filter((i) => i.area === area && i.difficulty === difficulty)
      if (candidates.length < need) {
        shortfalls.push({ area, difficulty, have: candidates.length, need })
      } else {
        picked.push(...shuffle(candidates).slice(0, need))
      }
    }
  }
  if (shortfalls.length > 0) return { ok: false, shortfalls }

  const ordered = shuffle(picked)
  return {
    ok: true,
    items: ordered,
    questionOrder: ordered.map((item) => item.id),
    choiceOrder: Object.fromEntries(ordered.map((item) => [item.id, shuffle(item.choiceIds)])),
  }
}
