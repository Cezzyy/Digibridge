import { z } from 'zod'

// Courses and year levels (PRO-04), asked through school links only.
// Stored as text, so these lists are the only check.

/** Regular courses run 1st to 4th year; TESDA scholar courses (HRT, WADT) run 1st to 3rd. */
export const COURSES = ['BSIT', 'BSCS', 'BSBA', 'BSA', 'BSHM', 'HRT', 'WADT'] as const
export const courseSchema = z.enum(COURSES, { error: 'Pick your course from the list.' })
export type Course = (typeof COURSES)[number]

export const TESDA_COURSES = ['HRT', 'WADT'] as const satisfies readonly Course[]

export const YEAR_LEVELS = [1, 2, 3, 4] as const
export type YearLevel = (typeof YEAR_LEVELS)[number]

export const YEAR_LEVEL_LABELS = {
  1: '1st year',
  2: '2nd year',
  3: '3rd year',
  4: '4th year',
} as const satisfies Record<YearLevel, string>

export const COURSE_MAX_YEAR_LEVEL = {
  BSIT: 4,
  BSCS: 4,
  BSBA: 4,
  BSA: 4,
  BSHM: 4,
  HRT: 3,
  WADT: 3,
} as const satisfies Record<Course, YearLevel>

/** Any year level (1 to 4). Use `isYearLevelInCourse` to check it against the course. */
export const yearLevelSchema = z.literal(YEAR_LEVELS, {
  error: 'Pick your year level from the list.',
})

/** The year levels a course offers, for the profile form's year-level picker. */
export const yearLevelsFor = (course: Course): YearLevel[] =>
  YEAR_LEVELS.filter((year) => year <= COURSE_MAX_YEAR_LEVEL[course])

export const isYearLevelInCourse = (course: Course, yearLevel: number): boolean =>
  Number.isInteger(yearLevel) && yearLevel >= 1 && yearLevel <= COURSE_MAX_YEAR_LEVEL[course]

export const yearLevelNotInCourseMessage = (course: Course): string =>
  `${course} only goes up to ${YEAR_LEVEL_LABELS[COURSE_MAX_YEAR_LEVEL[course]]}.`
