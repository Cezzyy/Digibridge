import { z } from 'zod'

// Date of birth (PRO-01), asked in both modes instead of age, so the age stays right however
// long after the profile it's read. Age is worked out on the date in the Philippines.

export const AGE_MIN = 10
export const AGE_MAX = 99

/** Where "today" is decided, for ages here and in the database's range check. */
export const PROFILE_TIME_ZONE = 'Asia/Manila'

/** A date as `YYYY-MM-DD`, the way Postgres `date` columns send and take it. */
export type IsoDate = `${number}-${number}-${number}`

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

/** Builds `YYYY-MM-DD` from a year, month (1 to 12) and day. */
export const toIsoDate = (year: number, month: number, day: number): IsoDate =>
  `${pad(year, 4)}-${pad(month)}-${pad(day)}` as IsoDate

/** Days in a month (1 to 12), counting February 29 in leap years. */
export const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate()

/** A `YYYY-MM-DD` date's year, month (1 to 12) and day, or null if it isn't in that shape. */
export const parseIsoDate = (date: string): { year: number; month: number; day: number } | null => {
  const match = ISO_DATE.exec(date)
  if (!match) return null
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number]
  return { year, month, day }
}

const mustParse = (date: string) => {
  const p = parseIsoDate(date)
  if (!p) throw new Error(`Not a YYYY-MM-DD date: ${date}`)
  return p
}

/** True for a `YYYY-MM-DD` date that exists (no February 30). */
export const isRealDate = (date: string): boolean => {
  const p = parseIsoDate(date)
  return !!p && p.month >= 1 && p.month <= 12 && p.day >= 1 && p.day <= daysInMonth(p.year, p.month)
}

// Built once: the form re-checks the date on every keystroke.
const philippineDate = new Intl.DateTimeFormat('en-US', {
  timeZone: PROFILE_TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
})

/** Today's date in the Philippines. */
export const todayInPhilippines = (now = new Date()): IsoDate => {
  const found = Object.fromEntries(
    philippineDate.formatToParts(now).map((part) => [part.type, Number(part.value)]),
  )
  return toIsoDate(found.year ?? Number.NaN, found.month ?? Number.NaN, found.day ?? Number.NaN)
}

/**
 * Whole years from `birthDate` to `onDate`. Someone born on February 29 turns a year older on
 * March 1 in other years, which matches Postgres's `date - interval 'n years'`.
 */
export const ageOn = (birthDate: string, onDate: string): number => {
  const born = parseIsoDate(birthDate)
  const on = parseIsoDate(onDate)
  if (!born || !on) return Number.NaN
  const hadBirthday = on.month > born.month || (on.month === born.month && on.day >= born.day)
  return on.year - born.year - (hadBirthday ? 0 : 1)
}

/** The same day `years` years earlier. February 29 becomes February 28 in other years. */
export const yearsBefore = (date: string, years: number): IsoDate => {
  const p = mustParse(date)
  const year = p.year - years
  return toIsoDate(year, p.month, Math.min(p.day, daysInMonth(year, p.month)))
}

/** The date `days` days after `date` (before it, when `days` is negative). */
export const addDays = (date: string, days: number): IsoDate => {
  const p = mustParse(date)
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + days))
  return toIsoDate(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate())
}

/**
 * The birth dates that make someone AGE_MIN to AGE_MAX years old on `today`: from the day after
 * `today` AGE_MAX + 1 years ago, to `today` AGE_MIN years ago. Same bounds as the database's
 * `respondents_birth_date_range` check.
 */
export const birthDateRange = (today: string = todayInPhilippines()) => ({
  earliest: addDays(yearsBefore(today, AGE_MAX + 1), 1),
  latest: yearsBefore(today, AGE_MIN),
})

export const BIRTH_DATE_MESSAGES = {
  missing: 'Enter your date of birth.',
  incomplete: 'Enter the whole date: month, day and year.',
  notReal: 'That date doesn’t exist. Check the month and day.',
  future: 'Your date of birth can’t be in the future.',
  outOfRange: `Check the year. You need to be ${AGE_MIN} to ${AGE_MAX} years old.`,
} as const

/**
 * `YYYY-MM-DD`, a date that exists, not after today, and an age from AGE_MIN to AGE_MAX today
 * in the Philippines. Each check stops the next, so a student gets one message at a time.
 */
export const birthDateSchema = z
  .string({ error: BIRTH_DATE_MESSAGES.missing })
  .min(1, { message: BIRTH_DATE_MESSAGES.missing, abort: true })
  .regex(ISO_DATE, { message: BIRTH_DATE_MESSAGES.incomplete, abort: true })
  .refine(isRealDate, { message: BIRTH_DATE_MESSAGES.notReal, abort: true })
  .refine((date) => date <= todayInPhilippines(), {
    message: BIRTH_DATE_MESSAGES.future,
    abort: true,
  })
  .refine(
    (date) => {
      const { earliest, latest } = birthDateRange()
      return date >= earliest && date <= latest
    },
    { message: BIRTH_DATE_MESSAGES.outOfRange },
  )
  .meta({ format: 'date', examples: ['2007-06-15'] })
