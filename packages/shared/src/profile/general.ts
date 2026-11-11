import { z } from 'zod'
import { SEXES } from '../enums'
import { birthDateSchema } from './birth-date'
import { deviceSchema, internetAccessSchema } from './digital-access'

// The general profile (PRO-01), asked in both modes. Online uses it on its own; the
// school profile adds the school details (see school.ts).

export const FULL_NAME_MAX_LENGTH = 100

/**
 * At least one pick, no repeats, and "none" only on its own. The "none" check counts
 * distinct picks, so a repeated "none" gets only the repeat message.
 */
const pickList = <T extends string>(item: z.ZodType<T>, what: string) =>
  z
    .array(item, { error: `Pick at least one ${what}.` })
    .min(1, { message: `Pick at least one ${what}.` })
    .refine((picks) => new Set(picks).size === picks.length, {
      message: `Pick each ${what} only once.`,
    })
    .refine((picks) => !picks.includes('none' as T) || new Set(picks).size === 1, {
      message: `"None" can't be picked with other answers.`,
    })

export const FULL_NAME_MESSAGES = {
  missing: 'Enter your full name.',
  tooLong: `Your name can be at most ${FULL_NAME_MAX_LENGTH} characters.`,
  characters: "Use letters only. Spaces, hyphens (-), apostrophes (') and periods (.) are fine.",
  twoParts: 'Enter your first and last name.',
} as const

/** Starts with a letter; then letters (any language, ñ and accents too), spaces, - ' ’ and . */
export const FULL_NAME_REGEX = /^\p{L}[\p{L}\p{M} '’.-]*$/u

/** Trimmed, with runs of spaces made one: the name as it's saved. */
export const normalizeFullName = (name: string): string => name.trim().replace(/\s+/g, ' ')

/**
 * Trimmed, with runs of spaces made one, then checked one rule at a time: filled in, not too
 * long, only name characters, and at least two words (first and last name).
 */
export const fullNameSchema = z
  .string({ error: FULL_NAME_MESSAGES.missing })
  .overwrite(normalizeFullName)
  .min(1, { message: FULL_NAME_MESSAGES.missing, abort: true })
  .max(FULL_NAME_MAX_LENGTH, { message: FULL_NAME_MESSAGES.tooLong, abort: true })
  .regex(FULL_NAME_REGEX, { message: FULL_NAME_MESSAGES.characters, abort: true })
  .refine((name) => name.split(' ').filter((word) => /\p{L}/u.test(word)).length >= 2, {
    message: FULL_NAME_MESSAGES.twoParts,
  })

/** Strict: any field it doesn't list, such as a school field, fails (PRO-06). */
export const generalProfileSchema = z.strictObject(
  {
    fullName: fullNameSchema,
    birthDate: birthDateSchema,
    sex: z.enum(SEXES, { error: 'Pick an answer for sex.' }),
    devices: pickList(deviceSchema, 'device'),
    internetAccess: pickList(internetAccessSchema, 'way you get internet'),
  },
  {
    error: (issue) =>
      issue.code === 'unrecognized_keys'
        ? "Your answers include a question this form doesn't ask."
        : 'Fill in your profile.',
  },
)
export type GeneralProfile = z.infer<typeof generalProfileSchema>
