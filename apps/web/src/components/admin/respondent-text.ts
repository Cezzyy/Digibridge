import {
  HIDDEN_IDENTITY,
  MODE_LABELS,
  YEAR_LEVEL_LABELS,
  type Mode,
  type RespondentStatus,
  type YearLevel,
} from '@digibridge/shared'

// Words for a respondent on the team's pages (DSH-05). Names and student numbers come as null
// for respondents who chose not to show who they are, and read Hidden (PRO-05).

export const nameText = (row: { fullName: string | null }) => row.fullName ?? HIDDEN_IDENTITY

/** "Online", or "School link · BSIT 2A" once the link is known. */
export function modeText(row: { mode: Mode; schoolLink: { label: string } | null }) {
  return row.schoolLink ? `${MODE_LABELS.school} · ${row.schoolLink.label}` : MODE_LABELS[row.mode]
}

/** "BSIT, 2nd year", or null online. */
export function classText(row: { course: string | null; yearLevel: number | null }) {
  if (!row.course) return null
  const year = row.yearLevel ? YEAR_LEVEL_LABELS[row.yearLevel as YearLevel] : null
  return year ? `${row.course}, ${year}` : row.course
}

/** Option values as their labels, joined: "Smartphone, Laptop". */
export const listText = <K extends string>(values: readonly string[], labels: Record<K, string>) =>
  values.map((value) => labels[value as K] ?? value).join(', ')

/** "18 min 20 s". */
export function durationText(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes === 0) return `${rest} s`
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`
}

export const RESPONDENT_STATUS_BADGE = {
  not_started: 'bg-mist-soft text-quiet',
  in_progress: 'bg-marigold-soft text-marigold-text',
  finished: 'bg-evergreen-soft text-evergreen',
  voided: 'bg-error-soft text-error',
} as const satisfies Record<RespondentStatus, string>

export const RESPONDENT_STATUS_DOT = {
  not_started: 'bg-line-strong',
  in_progress: 'bg-marigold',
  finished: 'bg-evergreen',
  voided: 'bg-error',
} as const satisfies Record<RespondentStatus, string>
