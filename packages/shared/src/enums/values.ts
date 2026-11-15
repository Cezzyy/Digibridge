import { z } from 'zod'

// Values of the 8 database enums. The Drizzle schema builds its pgEnums from these,
// so the database, the API and the web app share one list.

export const ROLES = ['respondent', 'facilitator', 'admin'] as const
export const roleSchema = z.enum(ROLES)
export type Role = (typeof ROLES)[number]
// Roles that may open the admin pages (requireRole(...STAFF_ROLES) in the API).
export const STAFF_ROLES = ['facilitator', 'admin'] as const satisfies readonly Role[]

export const MODES = ['online', 'school'] as const
export const modeSchema = z.enum(MODES)
export type Mode = (typeof MODES)[number]

export const SEXES = ['male', 'female', 'prefer_not_to_say'] as const
export const sexSchema = z.enum(SEXES)
export type Sex = (typeof SEXES)[number]

export const DIFFICULTIES = ['basic', 'intermediate', 'advanced'] as const
export const difficultySchema = z.enum(DIFFICULTIES)
export type Difficulty = (typeof DIFFICULTIES)[number]

export const LEVELS = ['beginner', 'basic', 'intermediate', 'advanced'] as const
export const levelSchema = z.enum(LEVELS)
export type Level = (typeof LEVELS)[number]

export const LESSON_TIERS = ['foundations', 'intermediate', 'advanced'] as const
export const lessonTierSchema = z.enum(LESSON_TIERS)
export type LessonTier = (typeof LESSON_TIERS)[number]

export const ATTEMPT_STATUSES = ['in_progress', 'submitted', 'expired', 'voided'] as const
export const attemptStatusSchema = z.enum(ATTEMPT_STATUSES)
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number]
/** Submitted, or closed by the timer: both are scored, and only these count in results and stats. */
export const FINISHED_ATTEMPT_STATUSES = [
  'submitted',
  'expired',
] as const satisfies readonly AttemptStatus[]
export type FinishedAttemptStatus = (typeof FINISHED_ATTEMPT_STATUSES)[number]

/**
 * Why an admin voided an attempt (USR-03). A note is required with `other` and optional with the
 * rest. A voided attempt is left out of every result and stat, and the respondent can start again.
 */
export const VOID_REASONS = [
  'technical',
  'wrong_person',
  'duplicate',
  'retake_requested',
  'test_entry',
  'not_eligible',
  'other',
] as const
export const voidReasonSchema = z.enum(VOID_REASONS)
export type VoidReason = (typeof VOID_REASONS)[number]
