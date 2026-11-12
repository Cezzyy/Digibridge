import { z } from 'zod'
import { addDays, isRealDate, todayInPhilippines, type IsoDate } from '../profile/birth-date'
import {
  courseSchema,
  isYearLevelInCourse,
  yearLevelNotInCourseMessage,
  yearLevelSchema,
} from '../profile/course'

// School links (LNK-01, LNK-02): an admin makes one for a class, with the school it's for, a
// label, an expiry, and optionally a course and year-level lock and a response limit.

export const LINK_SCHOOL_MAX_LENGTH = 100
export const LINK_LABEL_MAX_LENGTH = 60
/** The latest expiry an admin can pick, in days from today. */
export const LINK_MAX_DAYS = 60
export const LINK_MAX_RESPONSES = 1000

/** Characters in a link's code: no 0, O, 1, I or L, so a code read aloud can't be misheard. */
export const LINK_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
/** 31^10 is about 8 × 10^14 codes: too many to guess one. */
export const LINK_CODE_LENGTH = 10

export const LINK_STATUSES = ['open', 'closed', 'expired', 'full'] as const
export const linkStatusSchema = z.enum(LINK_STATUSES)
export type LinkStatus = (typeof LINK_STATUSES)[number]

export const LINK_STATUS_LABELS = {
  open: 'Open',
  closed: 'Closed',
  expired: 'Expired',
  full: 'Full',
} as const satisfies Record<LinkStatus, string>

/** What decides a link's status. `responses` counts the students who joined through it. */
export type LinkState = {
  closedAt: Date | null
  expiresAt: Date
  maxResponses: number | null
  responses: number
}

/** Closed by an admin first, then past its expiry, then at its response limit; else open. */
export function linkStatus(link: LinkState, now = new Date()): LinkStatus {
  if (link.closedAt) return 'closed'
  if (link.expiresAt <= now) return 'expired'
  if (link.maxResponses !== null && link.responses >= link.maxResponses) return 'full'
  return 'open'
}

/**
 * When a link picked to last until `date` closes: the end of that day in the Philippines, which
 * is midnight at the start of the next. Manila has no daylight saving, so it's always UTC+8.
 */
export const linkExpiresAt = (date: IsoDate | string): Date =>
  new Date(`${addDays(date, 1)}T00:00:00+08:00`)

export const LINK_MESSAGES = {
  school: 'Enter the school this link is for.',
  schoolTooLong: `Keep the school to ${LINK_SCHOOL_MAX_LENGTH} characters or fewer.`,
  label: 'Give the link a name, like BSIT 2A.',
  labelTooLong: `Keep the name to ${LINK_LABEL_MAX_LENGTH} characters or fewer.`,
  expiresOn: 'Pick the last day the link stays open.',
  expiresOnPast: 'The last day can’t be in the past.',
  expiresOnTooFar: `Pick a day within ${LINK_MAX_DAYS} days from today.`,
  maxResponses: `Enter a whole number from 1 to ${LINK_MAX_RESPONSES}, or leave it empty.`,
} as const

const trimmedText = (max: number, missing: string, tooLong: string) =>
  z
    .string({ error: missing })
    .trim()
    .min(1, { message: missing, abort: true })
    .max(max, { message: tooLong })

/**
 * A new school link (LNK-01). `expiresOn` is the last day it stays open (`YYYY-MM-DD`, from
 * today to LINK_MAX_DAYS ahead, in the Philippines). Course, year level and the response limit
 * are null for "any" and "no limit"; a year level with a course must be one that course has.
 * Refined, so build on it with `.safeExtend()`, not `.extend()`.
 */
export const schoolLinkSchema = z
  .strictObject(
    {
      school: trimmedText(
        LINK_SCHOOL_MAX_LENGTH,
        LINK_MESSAGES.school,
        LINK_MESSAGES.schoolTooLong,
      ),
      label: trimmedText(LINK_LABEL_MAX_LENGTH, LINK_MESSAGES.label, LINK_MESSAGES.labelTooLong),
      course: courseSchema.nullable().default(null),
      yearLevel: yearLevelSchema.nullable().default(null),
      maxResponses: z
        .int({ error: LINK_MESSAGES.maxResponses })
        .min(1, { message: LINK_MESSAGES.maxResponses })
        .max(LINK_MAX_RESPONSES, { message: LINK_MESSAGES.maxResponses })
        .nullable()
        .default(null),
      expiresOn: z
        .string({ error: LINK_MESSAGES.expiresOn })
        .refine(isRealDate, { message: LINK_MESSAGES.expiresOn, abort: true })
        .refine((date) => date >= todayInPhilippines(), {
          message: LINK_MESSAGES.expiresOnPast,
          abort: true,
        })
        .refine((date) => date <= addDays(todayInPhilippines(), LINK_MAX_DAYS), {
          message: LINK_MESSAGES.expiresOnTooFar,
        })
        .meta({ format: 'date', examples: ['2026-11-20'] }),
    },
    {
      error: (issue) =>
        issue.code === 'unrecognized_keys'
          ? 'The link includes a field this form doesn’t have.'
          : 'Fill in the link’s details.',
    },
  )
  .superRefine((link, ctx) => {
    if (link.course && link.yearLevel && !isYearLevelInCourse(link.course, link.yearLevel)) {
      ctx.addIssue({
        code: 'custom',
        path: ['yearLevel'],
        message: yearLevelNotInCourseMessage(link.course),
      })
    }
  })
export type SchoolLinkInput = z.input<typeof schoolLinkSchema>
export type SchoolLink = z.output<typeof schoolLinkSchema>
