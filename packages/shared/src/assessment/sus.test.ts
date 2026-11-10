import { describe, expect, it } from 'vitest'
import {
  SUS_ANSWER_LABELS,
  SUS_ANSWER_MAX,
  SUS_ANSWER_MIN,
  SUS_STATEMENT_COUNT,
  SUS_STATEMENTS,
  susAnswersSchema,
} from './sus'

describe('SUS', () => {
  it('has one statement per answer and one label per scale point', () => {
    expect(SUS_STATEMENTS).toHaveLength(SUS_STATEMENT_COUNT)
    expect(SUS_ANSWER_LABELS).toHaveLength(SUS_ANSWER_MAX - SUS_ANSWER_MIN + 1)
  })

  it('takes 10 whole answers from 1 to 5', () => {
    expect(susAnswersSchema.safeParse([1, 2, 3, 4, 5, 5, 4, 3, 2, 1]).success).toBe(true)
  })

  it.each([
    ['too few', [3, 3, 3, 3, 3, 3, 3, 3, 3]],
    ['too many', [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]],
    ['a 0', [0, 3, 3, 3, 3, 3, 3, 3, 3, 3]],
    ['a 6', [3, 3, 3, 3, 3, 3, 3, 3, 3, 6]],
    ['a fraction', [3, 3, 3, 3, 2.5, 3, 3, 3, 3, 3]],
  ])('refuses %s', (_, answers) => {
    expect(susAnswersSchema.safeParse(answers).success).toBe(false)
  })
})
