import { describe, expect, it } from 'vitest'
import { COURSES, isYearLevelInCourse, yearLevelSchema, yearLevelsFor } from './course'

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
