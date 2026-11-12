import { attempts, respondents } from '@digibridge/db'
import { AGE_GROUP_RANGES, PROFILE_TIME_ZONE, type DashboardFilters } from '@digibridge/shared'
import {
  arrayContains,
  between,
  desc,
  eq,
  gte,
  lte,
  sql,
  type SQL,
  type SQLWrapper,
} from 'drizzle-orm'
import type { Db } from '../config/db'

// The dashboard filters (DSH-03) as SQL, for the respondents table, the analysis page and item
// analysis. Every condition is on `respondents`, except the school link, which is on the
// attempt each caller joins.

const timeZone = sql.raw(`'${PROFILE_TIME_ZONE}'`)

/** The day a respondent consented, in the Philippines. */
export const consentDay = sql<string>`(${respondents.consentedAt} at time zone ${timeZone})::date`

/**
 * Their age on that day: whole years, as `ageOn` in packages/shared and the database's
 * `respondents_birth_date_range` check count it.
 */
export const ageAtConsent = sql<number>`extract(year from age(${consentDay}, ${respondents.birthDate}))::int`

/** The filters that are set, as conditions to AND together. `schoolLinkId` is the attempt's. */
export function dashboardConditions(filters: DashboardFilters, schoolLinkId: SQLWrapper) {
  const conditions: SQL[] = []
  if (filters.sex) conditions.push(eq(respondents.sex, filters.sex))
  if (filters.ageGroup) {
    const { min, max } = AGE_GROUP_RANGES[filters.ageGroup]
    conditions.push(between(ageAtConsent, min, max))
  }
  if (filters.device) conditions.push(arrayContains(respondents.devices, [filters.device]))
  if (filters.internetAccess) {
    conditions.push(arrayContains(respondents.internetAccess, [filters.internetAccess]))
  }
  if (filters.mode) conditions.push(eq(respondents.mode, filters.mode))
  // School respondents only: online rows have no link, course or year level, so they drop out.
  if (filters.schoolLinkId) conditions.push(sql`${schoolLinkId} = ${filters.schoolLinkId}`)
  if (filters.course) conditions.push(eq(respondents.course, filters.course))
  if (filters.yearLevel !== undefined) conditions.push(eq(respondents.yearLevel, filters.yearLevel))
  if (filters.from) conditions.push(gte(consentDay, filters.from))
  if (filters.to) conditions.push(lte(consentDay, filters.to))
  return conditions
}

/**
 * Each respondent's attempt: the one that isn't voided (there's at most one), or else the latest
 * voided one. Left join it on `respondent_id` to filter respondents by their attempt's link.
 */
export const currentAttempts = (db: Db) =>
  db
    .selectDistinctOn([attempts.respondentId])
    .from(attempts)
    .orderBy(attempts.respondentId, sql`${attempts.status} = 'voided'`, desc(attempts.startedAt))
    .as('current_attempt')

export type CurrentAttempts = ReturnType<typeof currentAttempts>
