// Values of the 7 database enums. The Drizzle schema builds its pgEnums from these,
// so the database, the API and the web app share one list.

export const ROLES = ['respondent', 'facilitator', 'admin'] as const
export type Role = (typeof ROLES)[number]

export const MODES = ['online', 'kiosk'] as const
export type Mode = (typeof MODES)[number]

export const SEXES = ['male', 'female', 'prefer_not_to_say'] as const
export type Sex = (typeof SEXES)[number]

export const DIFFICULTIES = ['basic', 'intermediate', 'advanced'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

export const LEVELS = ['beginner', 'basic', 'intermediate', 'advanced'] as const
export type Level = (typeof LEVELS)[number]

export const LESSON_TIERS = ['foundations', 'intermediate', 'advanced'] as const
export type LessonTier = (typeof LESSON_TIERS)[number]

export const ATTEMPT_STATUSES = ['in_progress', 'submitted', 'expired', 'voided'] as const
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number]
