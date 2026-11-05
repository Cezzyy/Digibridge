import { describe, expect, it } from 'vitest'
import {
  COURSES,
  isYearLevelInCourse,
  STUDENT_NUMBER_EXAMPLE,
  studentNumberSchema,
  yearLevelSchema,
  yearLevelsFor,
} from './respondent'

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

describe('year levels', () => {
  it('gives 4 years to regular courses and 3 to TESDA courses', () => {
    expect(yearLevelsFor('BSIT')).toEqual([1, 2, 3, 4])
    expect(yearLevelsFor('BSHM')).toEqual([1, 2, 3, 4])
    expect(yearLevelsFor('HRT')).toEqual([1, 2, 3])
    expect(yearLevelsFor('WADT')).toEqual([1, 2, 3])
  })

  it('checks the year level against the course', () => {
    expect(isYearLevelInCourse('BSA', 4)).toBe(true)
    expect(isYearLevelInCourse('HRT', 3)).toBe(true)
    expect(isYearLevelInCourse('HRT', 4)).toBe(false)
    expect(isYearLevelInCourse('WADT', 4)).toBe(false)
    for (const course of COURSES) {
      expect(isYearLevelInCourse(course, 0)).toBe(false)
      expect(isYearLevelInCourse(course, 5)).toBe(false)
      expect(isYearLevelInCourse(course, 1.5)).toBe(false)
    }
  })

  it('accepts only whole years 1 to 4', () => {
    expect(yearLevelSchema.parse(1)).toBe(1)
    expect(yearLevelSchema.parse(4)).toBe(4)
    for (const bad of [0, 5, 2.5, '2']) {
      expect(yearLevelSchema.safeParse(bad).success).toBe(false)
    }
  })
})
