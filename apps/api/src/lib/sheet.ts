import { PROFILE_TIME_ZONE } from '@digibridge/shared'

// A table to write as CSV (lib/csv.ts) or as a sheet of an Excel workbook (lib/xlsx.ts).

/** Empty when null. A date is written in Philippine time, as the dashboard counts days. */
export type Cell = string | number | Date | null

export type Column = {
  header: string
  /** Width in characters, in Excel. Fits the header when left out. */
  width?: number
  /** Wraps long text onto more lines, in Excel. */
  wrap?: boolean
}

export type Sheet = { name: string; columns: Column[]; rows: Cell[][] }

const parts = new Intl.DateTimeFormat('en-US', {
  timeZone: PROFILE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/** The date and time on a clock in the Philippines. */
export const philippineTime = (date: Date) =>
  Object.fromEntries(
    parts.formatToParts(date).map(({ type, value }) => [type, Number(value)]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>

const pad = (n: number) => String(n).padStart(2, '0')

/** `2026-11-16 14:03:05`, in Philippine time: the form Excel and SPSS read as a date and time. */
export function philippineDateTime(date: Date) {
  const t = philippineTime(date)
  return `${t.year}-${pad(t.month)}-${pad(t.day)} ${pad(t.hour)}:${pad(t.minute)}:${pad(t.second)}`
}
