import { describe, expect, it } from 'vitest'
import { ITEMS_PER_AREA, ITEMS_PER_ATTEMPT } from './rules'
import { LEVELS } from '../enums'
import {
  AREA_MAX_POINTS,
  LESSON_TIERS_FOR_LEVEL,
  LEVEL_CUTOFFS,
  levelForPct,
  OVERALL_MAX_POINTS,
} from './scoring'

describe('totals', () => {
  it('matches the PRD: 10 items and 18 points per area, 30 items and 54 points overall', () => {
    expect(ITEMS_PER_AREA).toBe(10)
    expect(ITEMS_PER_ATTEMPT).toBe(30)
    expect(AREA_MAX_POINTS).toBe(18)
    expect(OVERALL_MAX_POINTS).toBe(54)
  })
})

describe('levelForPct', () => {
  it.each([
    [0, 'beginner'],
    [39.9, 'beginner'],
    [40, 'basic'],
    [59.9, 'basic'],
    [60, 'intermediate'],
    [79.9, 'intermediate'],
    [80, 'advanced'],
    [100, 'advanced'],
  ] as const)('%d%% is %s', (pct, level) => {
    expect(levelForPct(pct)).toBe(level)
  })

  it('works out the PRD example: 11 of 18 is Intermediate', () => {
    expect(levelForPct((11 / AREA_MAX_POINTS) * 100)).toBe('intermediate')
  })

  it('has one cut-off per level, highest first', () => {
    expect(LEVEL_CUTOFFS.map((c) => c.level).toSorted()).toEqual([...LEVELS].toSorted())
    const mins = LEVEL_CUTOFFS.map((c) => c.min)
    expect(mins).toEqual(mins.toSorted((a, b) => b - a))
    expect(mins.at(-1)).toBe(0)
  })
})

describe('LESSON_TIERS_FOR_LEVEL', () => {
  it('recommends lessons as in the PRD', () => {
    expect(LESSON_TIERS_FOR_LEVEL).toEqual({
      beginner: ['foundations'],
      basic: ['foundations', 'intermediate'],
      intermediate: ['intermediate', 'advanced'],
      advanced: ['advanced'],
    })
  })
})
