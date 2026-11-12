import { z } from 'zod'
import { modeSchema, sexSchema } from '../enums'
import { isRealDate } from '../profile/birth-date'
import { courseSchema, yearLevelSchema } from '../profile/course'
import { deviceSchema, internetAccessSchema } from '../profile/digital-access'
import { ageGroupSchema } from './age-groups'

// The filters the respondents table, the analysis page and item analysis share (DSH-03), sent
// as query parameters. Every one is optional; together they narrow the respondents with AND.

const isoDate = z
  .string()
  .refine(isRealDate, { message: 'Pick a date as YYYY-MM-DD.' })
  .meta({ format: 'date', examples: ['2026-11-20'] })

/**
 * Sex, age group, a device owned, a way of getting internet, mode, school link, course, year
 * level, and a consent date range (`from` and `to`, both included, in the Philippines). School
 * link, course and year level exist on school respondents only, so picking any of them shows
 * school respondents only (SCHOOL_ONLY_FILTERS).
 */
export const dashboardFiltersSchema = z.object({
  sex: sexSchema.optional(),
  ageGroup: ageGroupSchema.optional(),
  device: deviceSchema.optional(),
  internetAccess: internetAccessSchema.optional(),
  mode: modeSchema.optional(),
  schoolLinkId: z.uuid().optional(),
  course: courseSchema.optional(),
  // Query parameters come in as text.
  yearLevel: z.coerce.number().pipe(yearLevelSchema).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
})
export type DashboardFilters = z.infer<typeof dashboardFiltersSchema>

/** The filters only school respondents have. */
export const SCHOOL_ONLY_FILTERS = [
  'schoolLinkId',
  'course',
  'yearLevel',
] as const satisfies readonly (keyof DashboardFilters)[]

/** True when a filter that only school respondents have is set. */
export const hasSchoolOnlyFilter = (filters: DashboardFilters): boolean =>
  SCHOOL_ONLY_FILTERS.some((key) => filters[key] !== undefined)
