import { z } from 'zod'
import { dashboardFiltersSchema } from './filters'

// The analysis page (DSH-01 to DSH-04, SUS-05). Only finished attempts (submitted, or closed by
// the timer as expired) count in scores; voided ones count nowhere.

/** What the comparison chart can group finished respondents by (DSH-04). */
export const STATS_GROUPS = [
  'mode',
  'sex',
  'age_group',
  'device',
  'internet_access',
  'course',
  'year_level',
  'school_link',
] as const
export const statsGroupSchema = z.enum(STATS_GROUPS)
export type StatsGroup = (typeof STATS_GROUPS)[number]

export const STATS_GROUP_LABELS = {
  mode: 'Mode',
  sex: 'Sex',
  age_group: 'Age group',
  device: 'Device owned',
  internet_access: 'Internet access',
  course: 'Course',
  year_level: 'Year level',
  school_link: 'School link',
} as const satisfies Record<StatsGroup, string>

/** Groupings only school respondents have; the chart says it leaves online respondents out. */
export const SCHOOL_ONLY_GROUPS = [
  'course',
  'year_level',
  'school_link',
] as const satisfies readonly StatsGroup[]

/** Groupings where a respondent can be in more than one group (they pick several devices). */
export const MULTI_PICK_GROUPS = [
  'device',
  'internet_access',
] as const satisfies readonly StatsGroup[]

/** The page's query: the dashboard filters and what to group the comparison by. */
export const statsQuerySchema = dashboardFiltersSchema.extend({
  groupBy: statsGroupSchema.default('mode'),
})
export type StatsQuery = z.infer<typeof statsQuerySchema>

/** Width of each bar in the SUS spread: 0 to 10, 10 to 20, ... 90 to 100 (100 goes in the last). */
export const SUS_BIN_WIDTH = 10
