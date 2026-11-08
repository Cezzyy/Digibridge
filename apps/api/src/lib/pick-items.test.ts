import {
  AREA_CODES,
  CHOICES_PER_QUESTION,
  DIFFICULTIES,
  ITEMS_PER_ATTEMPT,
  ITEMS_PER_DIFFICULTY,
  type AreaCode,
  type Difficulty,
} from '@digibridge/shared'
import { describe, expect, it } from 'vitest'
import { pickItems, type PoolItem } from './pick-items'
import { randomInt, shuffle } from './shuffle'

const item = (area: AreaCode, difficulty: Difficulty, n: number): PoolItem => {
  const id = `${area}-${difficulty}-${n}`
  return {
    id,
    area,
    difficulty,
    choiceIds: Array.from({ length: CHOICES_PER_QUESTION }, (_, c) => `${id}-c${c}`),
  }
}

/** `perDifficulty` items of each difficulty in each area. */
const bank = (perDifficulty: (d: Difficulty) => number) =>
  AREA_CODES.flatMap((area) =>
    DIFFICULTIES.flatMap((d) =>
      Array.from({ length: perDifficulty(d) }, (_, n) => item(area, d, n)),
    ),
  )

const byId = (pool: PoolItem[]) => new Map(pool.map((i) => [i.id, i]))

describe('randomInt', () => {
  it('stays from 0 to max - 1 and reaches every value', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 500; i++) {
      const n = randomInt(5)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(5)
      seen.add(n)
    }
    expect(seen.size).toBe(5)
  })

  it.each([0, -1, 1.5])('refuses %d', (max) => {
    expect(() => randomInt(max)).toThrow(RangeError)
  })
})

describe('shuffle', () => {
  it('keeps every item once and leaves the input alone', () => {
    const input = Array.from({ length: 30 }, (_, i) => i)
    const copy = [...input]
    const result = shuffle(input)
    expect(input).toEqual(copy)
    expect(result.toSorted((a, b) => a - b)).toEqual(input)
  })

  it('changes the order', () => {
    const input = Array.from({ length: 30 }, (_, i) => i)
    // 30 items landing back in order by chance is 1 in 30!, so 3 tries all in order means a bug.
    const tries = [shuffle(input), shuffle(input), shuffle(input)]
    expect(tries.some((t) => t.join() !== input.join())).toBe(true)
  })
})

describe('pickItems', () => {
  it('picks 4 basic, 4 intermediate and 2 advanced per area from an exact bank', () => {
    const pool = bank((d) => ITEMS_PER_DIFFICULTY[d])
    const result = pickItems(pool)
    if (!result.ok) throw new Error('expected ok')

    expect(result.questionOrder).toHaveLength(ITEMS_PER_ATTEMPT)
    expect(new Set(result.questionOrder).size).toBe(ITEMS_PER_ATTEMPT)
    expect(result.questionOrder.toSorted()).toEqual(pool.map((i) => i.id).toSorted())
  })

  it('picks the 4/4/2 mix per area at random from a bigger bank', () => {
    const pool = bank(() => 6)
    const items = byId(pool)
    const picks = new Set<string>()
    for (let run = 0; run < 20; run++) {
      const result = pickItems(pool)
      if (!result.ok) throw new Error('expected ok')
      expect(result.questionOrder).toHaveLength(ITEMS_PER_ATTEMPT)
      expect(new Set(result.questionOrder).size).toBe(ITEMS_PER_ATTEMPT)
      for (const area of AREA_CODES) {
        for (const d of DIFFICULTIES) {
          const count = result.questionOrder.filter((id) => {
            const i = items.get(id)
            return i?.area === area && i.difficulty === d
          }).length
          expect(count, `${area} ${d}`).toBe(ITEMS_PER_DIFFICULTY[d])
        }
      }
      result.questionOrder.forEach((id) => picks.add(id))
    }
    // Over 20 runs, more than the 30 items of one run come up.
    expect(picks.size).toBeGreaterThan(ITEMS_PER_ATTEMPT)
  })

  it('shuffles each item’s own choices, all of them, once each', () => {
    const pool = bank((d) => ITEMS_PER_DIFFICULTY[d])
    const items = byId(pool)
    const result = pickItems(pool)
    if (!result.ok) throw new Error('expected ok')
    expect(Object.keys(result.choiceOrder).toSorted()).toEqual(result.questionOrder.toSorted())
    for (const [id, order] of Object.entries(result.choiceOrder)) {
      expect(order.toSorted()).toEqual([...(items.get(id)?.choiceIds ?? [])].toSorted())
    }
  })

  it('lists every area and difficulty that is short, and picks nothing', () => {
    const pool = bank((d) => ITEMS_PER_DIFFICULTY[d]).filter(
      (i) => !(i.area === 'safety' && i.difficulty === 'advanced' && i.id.endsWith('-1')),
    )
    expect(pickItems(pool)).toEqual({
      ok: false,
      shortfalls: [{ area: 'safety', difficulty: 'advanced', have: 1, need: 2 }],
    })
  })

  it('skips items without exactly 4 choices', () => {
    const pool = bank((d) => ITEMS_PER_DIFFICULTY[d]).map((i) =>
      i.id === 'communication-basic-0' ? { ...i, choiceIds: i.choiceIds.slice(0, 3) } : i,
    )
    expect(pickItems(pool)).toEqual({
      ok: false,
      shortfalls: [{ area: 'communication', difficulty: 'basic', have: 3, need: 4 }],
    })
  })
})
