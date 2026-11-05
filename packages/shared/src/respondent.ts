import { z } from 'zod'

// Option lists and field checks for the respondent profile (PRO-01, PRO-02, PRO-04).
// The database stores these as text, so these lists are the only place they are enforced.

/** ACLC student number, e.g. C23-01-7557-MAN121. Checked after trimming and uppercasing. */
export const STUDENT_NUMBER_REGEX = /^[A-Z]\d{2}-\d{2}-\d{4}-[A-Z]{3}\d{3}$/
export const STUDENT_NUMBER_EXAMPLE = 'C23-01-7557-MAN121'

/** Trims and uppercases the input, then checks the ACLC format. */
export const studentNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(STUDENT_NUMBER_REGEX, {
    message: `Enter your student number like this: ${STUDENT_NUMBER_EXAMPLE}`,
  })

/** Regular courses run 1st to 4th year; TESDA scholar courses (HRT, WADT) run 1st to 3rd. */
export const COURSES = ['BSIT', 'BSCS', 'BSBA', 'BSA', 'BSHM', 'HRT', 'WADT'] as const
export const courseSchema = z.enum(COURSES)
export type Course = (typeof COURSES)[number]

export const TESDA_COURSES = ['HRT', 'WADT'] as const satisfies readonly Course[]

export const COURSE_MAX_YEAR_LEVEL = {
  BSIT: 4,
  BSCS: 4,
  BSBA: 4,
  BSA: 4,
  BSHM: 4,
  HRT: 3,
  WADT: 3,
} as const satisfies Record<Course, YearLevel>

export const YEAR_LEVELS = [1, 2, 3, 4] as const
export type YearLevel = (typeof YEAR_LEVELS)[number]

export const YEAR_LEVEL_LABELS = {
  1: '1st year',
  2: '2nd year',
  3: '3rd year',
  4: '4th year',
} as const satisfies Record<YearLevel, string>

/** Any year level (1 to 4). Use `isYearLevelInCourse` to check it against the course. */
export const yearLevelSchema = z.literal(YEAR_LEVELS)

/** The year levels a course offers, for the profile form's year-level picker. */
export const yearLevelsFor = (course: Course): YearLevel[] =>
  YEAR_LEVELS.filter((year) => year <= COURSE_MAX_YEAR_LEVEL[course])

export const isYearLevelInCourse = (course: Course, yearLevel: number): boolean =>
  Number.isInteger(yearLevel) && yearLevel >= 1 && yearLevel <= COURSE_MAX_YEAR_LEVEL[course]

export const yearLevelNotInCourseMessage = (course: Course): string =>
  `${course} only goes up to ${YEAR_LEVEL_LABELS[COURSE_MAX_YEAR_LEVEL[course]]}.`

export const DEVICES = ['smartphone', 'laptop', 'desktop', 'tablet', 'none'] as const
export const deviceSchema = z.enum(DEVICES)
export type Device = (typeof DEVICES)[number]

export const DEVICE_LABELS = {
  smartphone: 'Smartphone',
  laptop: 'Laptop',
  desktop: 'Desktop computer',
  tablet: 'Tablet',
  none: 'None',
} as const satisfies Record<Device, string>

export const INTERNET_ACCESS = [
  'home_wifi',
  'mobile_data',
  'school_wifi',
  'piso_wifi',
  'none',
] as const
export const internetAccessSchema = z.enum(INTERNET_ACCESS)
export type InternetAccess = (typeof INTERNET_ACCESS)[number]

export const INTERNET_ACCESS_LABELS = {
  home_wifi: 'Wi-Fi at home',
  mobile_data: 'Mobile data',
  school_wifi: 'School Wi-Fi',
  piso_wifi: 'Piso Wi-Fi',
  none: 'None',
} as const satisfies Record<InternetAccess, string>
