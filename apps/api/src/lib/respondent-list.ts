import { respondents } from '@digibridge/db'
import {
  FINISHED_ATTEMPT_STATUSES,
  type ExportQuery,
  type Level,
  type RespondentSort,
  type RespondentStatus,
} from '@digibridge/shared'
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm'
import { dashboardConditions, type CurrentAttempts } from './dashboard-filters'

// The respondents table's rows and order (DSH-05), shared by its pages and the export (DSH-06),
// so a download has exactly the rows the table shows. Hidden names and student numbers are never
// searched or sorted on (PRO-05).

/** RESPONDENT_STATUSES from the respondent's attempt. Submitted and expired both have results. */
export const statusOf = (current: CurrentAttempts) =>
  sql<RespondentStatus>`case
    when ${current.id} is null then 'not_started'
    when ${current.status} = 'in_progress' then 'in_progress'
    when ${current.status} = 'voided' then 'voided'
    else 'finished' end`

/** The attempt's score and level, or null unless it's finished: a voided attempt is left out. */
export const finishedScore = (current: CurrentAttempts) => {
  const finished = inArray(current.status, FINISHED_ATTEMPT_STATUSES)
  return {
    pct: sql<number | null>`case when ${finished} then ${current.overallPct} end`.mapWith(
      current.overallPct,
    ),
    level: sql<Level | null>`case when ${finished} then ${current.overallLevel} end`,
  }
}

/** Hidden names sort last, as if blank, so their place in the list gives nothing away (PRO-05). */
export const respondentOrder = (sort: RespondentSort, current: CurrentAttempts): SQL[] => {
  const newest = [desc(respondents.consentedAt), desc(respondents.id)]
  switch (sort) {
    case 'newest':
      return newest
    case 'oldest':
      return [asc(respondents.consentedAt), asc(respondents.id)]
    case 'name':
      return [
        sql`case when ${respondents.showIdentity} then ${respondents.fullName} end asc nulls last`,
        ...newest,
      ]
    case 'score_high':
      return [sql`${finishedScore(current).pct} desc nulls last`, ...newest]
    case 'score_low':
      return [sql`${finishedScore(current).pct} asc nulls last`, ...newest]
  }
}

/** `%text%` for ILIKE, with the search's own `%`, `_` and `\` matched as themselves. */
const containing = (text: string) => `%${text.replace(/[\\%_]/g, '\\$&')}%`

/**
 * The dashboard filters, the status and the search, as conditions to AND together, on
 * `respondents` left joined to `current`.
 */
export function respondentConditions(
  { status, q, sort: _sort, ...filters }: ExportQuery,
  current: CurrentAttempts,
) {
  const conditions = dashboardConditions(filters)
  if (status) conditions.push(sql`${statusOf(current)} = ${status}`)
  if (q) {
    // Only shown identities can be found by name or student number (PRO-05).
    conditions.push(
      and(
        eq(respondents.showIdentity, true),
        or(
          ilike(respondents.fullName, containing(q)),
          ilike(respondents.studentNumber, containing(q)),
        ),
      )!,
    )
  }
  return conditions
}
