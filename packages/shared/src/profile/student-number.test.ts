import { describe, expect, it } from 'vitest'
import { STUDENT_NUMBER_EXAMPLE, studentNumberSchema } from './student-number'

describe('studentNumberSchema', () => {
  it('accepts the PRD example', () => {
    expect(studentNumberSchema.parse(STUDENT_NUMBER_EXAMPLE)).toBe('C23-01-7557-MAN121')
  })

  it('trims and uppercases before checking', () => {
    expect(studentNumberSchema.parse('  c23-01-7557-man121 ')).toBe('C23-01-7557-MAN121')
  })

  it.each([
    '',
    'C23017557MAN121',
    'C23-01-7557-MAN12',
    'C23-01-7557-MAN1212',
    'CC3-01-7557-MAN121',
    'C23-1-7557-MAN121',
    'C23-01-757-MAN121',
    'C23-01-7557-MA121',
    '123-01-7557-MAN121',
    'C23-01-7557-MAN121-X',
    'C23 01 7557 MAN121',
  ])('rejects %j', (input) => {
    const result = studentNumberSchema.safeParse(input)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain(STUDENT_NUMBER_EXAMPLE)
  })
})
