import { AREA_CODES, PROFILE_TIME_ZONE, type AreaCode } from '@digibridge/shared'

// Words and dates for the lessons editor's pages (CMS-04).

const EDITED = new Intl.DateTimeFormat('en-US', {
  timeZone: PROFILE_TIME_ZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** When a lesson was last saved, in Philippine time: "Nov 15, 2026, 1:48 PM". */
export const formatEdited = (iso: string) => EDITED.format(new Date(iso))

/** An area's number as the library shows it: "01". */
export const areaNumber = (code: AreaCode) => String(AREA_CODES.indexOf(code) + 1).padStart(2, '0')

/** One outside resource as the editor holds it, before it's checked. */
export type ResourceDraft = { label: string; url: string }

/** What's wrong with each resource row, by its number on screen. */
export type ResourceIssues = Record<number, { label?: string; url?: string }>
