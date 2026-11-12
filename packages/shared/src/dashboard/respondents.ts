import { z } from 'zod'
import { dashboardFiltersSchema } from './filters'

// The respondents table (DSH-05, DSH-07, PRO-05).

/**
 * Where a respondent is, from their attempts: not started (profile saved, no attempt), in
 * progress, finished (submitted, or closed by the timer as expired: both have results), or
 * voided (their only attempt was voided, so they can start again).
 */
export const RESPONDENT_STATUSES = ['not_started', 'in_progress', 'finished', 'voided'] as const
export const respondentStatusSchema = z.enum(RESPONDENT_STATUSES)
export type RespondentStatus = (typeof RESPONDENT_STATUSES)[number]

export const RESPONDENT_STATUS_LABELS = {
  not_started: 'Not started',
  in_progress: 'In progress',
  finished: 'Finished',
  voided: 'Voided',
} as const satisfies Record<RespondentStatus, string>

/** Newest first by consent, oldest first, by name (A to Z), or by overall score. */
export const RESPONDENT_SORTS = ['newest', 'oldest', 'name', 'score_high', 'score_low'] as const
export const respondentSortSchema = z.enum(RESPONDENT_SORTS)
export type RespondentSort = (typeof RESPONDENT_SORTS)[number]

export const RESPONDENT_SORT_LABELS = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  name: 'Name (A to Z)',
  score_high: 'Highest score',
  score_low: 'Lowest score',
} as const satisfies Record<RespondentSort, string>

export const RESPONDENTS_PAGE_SIZE = 20
export const RESPONDENT_SEARCH_MAX_LENGTH = 100

/**
 * Shown in place of the name and student number of a respondent who chose not to show who they
 * are (PRO-05). Their name and student number are never sent, searched or sorted on.
 */
export const HIDDEN_IDENTITY = 'Hidden'

/** The table's query: the dashboard filters, plus status, a search, the sort and the page. */
export const respondentListQuerySchema = dashboardFiltersSchema.extend({
  status: respondentStatusSchema.optional(),
  // Matches part of a shown name or student number.
  q: z.string().trim().max(RESPONDENT_SEARCH_MAX_LENGTH).optional(),
  sort: respondentSortSchema.default('newest'),
  page: z.coerce.number().pipe(z.int().min(1)).default(1),
})
export type RespondentListQuery = z.infer<typeof respondentListQuerySchema>
