import { z } from 'zod'
import { SEXES } from '../enums'
import { deviceSchema, internetAccessSchema } from './digital-access'

// The general profile (PRO-01), asked in both modes. Online uses it on its own; the
// kiosk profile adds the school details (see kiosk.ts).

export const FULL_NAME_MAX_LENGTH = 100
export const AGE_MIN = 10
export const AGE_MAX = 99

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

/** Strict: any field it doesn't list, such as a school field, fails (PRO-06). */
export const generalProfileSchema = z.strictObject(
  {
    fullName: z
      .string({ error: 'Enter your full name.' })
      .trim()
      .min(1, { message: 'Enter your full name.' })
      .max(FULL_NAME_MAX_LENGTH, {
        message: `Your name can be at most ${FULL_NAME_MAX_LENGTH} characters.`,
      }),
    age: z
      .int({ message: 'Enter your age as a whole number.' })
      .min(AGE_MIN, { message: `Age must be from ${AGE_MIN} to ${AGE_MAX}.` })
      .max(AGE_MAX, { message: `Age must be from ${AGE_MIN} to ${AGE_MAX}.` }),
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
