import { describe, expect, it } from 'vitest'
import { susScore } from './sus'

describe('susScore', () => {
  it('gives 50 when every answer is 3', () => {
    expect(susScore([3, 3, 3, 3, 3, 3, 3, 3, 3, 3])).toBe(50)
  })

  it('gives 100 for the best answers: 5 to the positive statements, 1 to the negative', () => {
    expect(susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])).toBe(100)
  })

  it('gives 0 for the worst answers: 1 to the positive statements, 5 to the negative', () => {
    expect(susScore([1, 5, 1, 5, 1, 5, 1, 5, 1, 5])).toBe(0)
  })

  it('gives 50 when every answer is 5 or every answer is 1, as the halves cancel out', () => {
    expect(susScore([5, 5, 5, 5, 5, 5, 5, 5, 5, 5])).toBe(50)
    expect(susScore([1, 1, 1, 1, 1, 1, 1, 1, 1, 1])).toBe(50)
  })

  it('works out a mixed example in steps of 2.5', () => {
    // Positive: 4-1, 4-1, 5-1, 3-1, 4-1 = 15. Negative: 5-2, 5-1, 5-2, 5-3, 5-2 = 15. 30 × 2.5.
    expect(susScore([4, 2, 4, 1, 5, 2, 3, 3, 4, 2])).toBe(75)
  })
})
