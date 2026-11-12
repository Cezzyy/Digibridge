import { describe, expect, it } from 'vitest'
import { ITEM_FLAG_MIN_SEEN, itemFlags } from './items'

const choices = (right: number, ...wrong: number[]) => [
  { isCorrect: true, picked: right },
  ...wrong.map((picked) => ({ isCorrect: false, picked })),
]

describe('itemFlags', () => {
  it('flags nothing until enough have seen it', () => {
    expect(itemFlags({ seen: ITEM_FLAG_MIN_SEEN - 1, correct: 0, choices: choices(0, 4) })).toEqual(
      [],
    )
  })

  it('flags too easy from 90% right', () => {
    expect(itemFlags({ seen: 10, correct: 9, choices: choices(9, 1) })).toEqual(['too_easy'])
    expect(itemFlags({ seen: 10, correct: 8, choices: choices(8, 2) })).toEqual([])
  })

  it('flags too hard below 20% right, and confusing when a wrong choice beats the right one', () => {
    expect(itemFlags({ seen: 10, correct: 2, choices: choices(2, 2, 2, 2) })).toEqual([])
    expect(itemFlags({ seen: 10, correct: 1, choices: choices(1, 6, 1) })).toEqual([
      'too_hard',
      'confusing',
    ])
  })

  it('counts blanks as not right', () => {
    // 1 of 10 right, the rest left blank: too hard, but no wrong choice beat the right one.
    expect(itemFlags({ seen: 10, correct: 1, choices: choices(1, 0, 0, 0) })).toEqual(['too_hard'])
  })
})
