import { z } from 'zod'
import { AGE_MAX, AGE_MIN } from '../profile/birth-date'

// Age groups for the dashboard's filter and comparison (DSH-03, DSH-04). A respondent's age is
// counted on the day they consented, in the Philippines (`ageOn`), the same way the database's
// `respondents_birth_date_range` check counts it, so a respondent never moves group.

export const AGE_GROUPS = ['under_18', '18_20', '21_23', '24_up'] as const
export const ageGroupSchema = z.enum(AGE_GROUPS)
export type AgeGroup = (typeof AGE_GROUPS)[number]

/** Youngest and oldest age in each group, both included. Together they cover AGE_MIN to AGE_MAX. */
export const AGE_GROUP_RANGES = {
  under_18: { min: AGE_MIN, max: 17 },
  '18_20': { min: 18, max: 20 },
  '21_23': { min: 21, max: 23 },
  '24_up': { min: 24, max: AGE_MAX },
} as const satisfies Record<AgeGroup, { min: number; max: number }>

export const AGE_GROUP_LABELS = {
  under_18: '17 and under',
  '18_20': '18 to 20',
  '21_23': '21 to 23',
  '24_up': '24 and over',
} as const satisfies Record<AgeGroup, string>

/** The group an age falls in. Ages outside AGE_MIN to AGE_MAX go to the nearest end. */
export const ageGroupFor = (age: number): AgeGroup =>
  AGE_GROUPS.find((group) => age <= AGE_GROUP_RANGES[group].max) ?? '24_up'
