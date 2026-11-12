import {
  PROFILE_TIME_ZONE,
  YEAR_LEVEL_LABELS,
  type LinkStatus,
  type YearLevel,
} from '@digibridge/shared'

// Words for a school link's details on the links page. Dates are the Philippine ones, where
// a link's last day is counted.

const DAY = new Intl.DateTimeFormat('en-US', {
  timeZone: PROFILE_TIME_ZONE,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

/** Like "Fri, Nov 20, 2026", on the Philippine calendar. */
export const formatDay = (at: Date | string) => DAY.format(new Date(at))

/** A `YYYY-MM-DD` day as is, like "Fri, Nov 20, 2026". Noon UTC is that same day in Manila. */
export const formatIsoDay = (date: string) => DAY.format(new Date(`${date}T12:00:00Z`))

/** The last day a link stays open: it expires at midnight after it. */
export const lastOpenDay = (expiresAt: string) => formatDay(new Date(Date.parse(expiresAt) - 1))

/** Who the link is for, like "BSIT, 2nd year" or "Any course and year level". */
export function lockText(course: string | null, yearLevel: number | null) {
  const year = yearLevel ? YEAR_LEVEL_LABELS[yearLevel as YearLevel] : null
  if (course && year) return `${course}, ${year}`
  if (course) return `${course}, any year level`
  if (year) return `Any course, ${year}`
  return 'Any course and year level'
}

/** How many students have joined, against the limit if there is one. */
export function responsesText(responses: number, maxResponses: number | null) {
  if (maxResponses !== null) return `${responses} of ${maxResponses} students`
  return `${responses} ${responses === 1 ? 'student' : 'students'}, no limit`
}

export const STATUS_BADGE = {
  open: 'bg-evergreen-soft text-evergreen',
  full: 'bg-marigold-soft text-marigold-text',
  expired: 'bg-mist-soft text-quiet',
  closed: 'bg-mist-soft text-quiet',
} as const satisfies Record<LinkStatus, string>

export const STATUS_DOT = {
  open: 'bg-evergreen',
  full: 'bg-marigold',
  expired: 'bg-line-strong',
  closed: 'bg-line-strong',
} as const satisfies Record<LinkStatus, string>

/** The status filter on the links page: ended is expired and closed together. */
export const LINK_FILTERS = ['all', 'open', 'full', 'ended'] as const
export type LinkFilter = (typeof LINK_FILTERS)[number]

export const LINK_FILTER_LABELS = {
  all: 'All',
  open: 'Open',
  full: 'Full',
  ended: 'Ended',
} as const satisfies Record<LinkFilter, string>

export const inFilter = (status: LinkStatus, filter: LinkFilter) =>
  filter === 'all' ||
  status === filter ||
  (filter === 'ended' && (status === 'expired' || status === 'closed'))
