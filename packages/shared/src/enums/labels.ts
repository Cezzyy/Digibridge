import type { LessonTier, Level, Role, Sex } from './values'

// Labels shown to students for the enum values they see.

export const SEX_LABELS = {
  male: 'Male',
  female: 'Female',
  prefer_not_to_say: 'Prefer not to say',
} as const satisfies Record<Sex, string>

export const LEVEL_LABELS = {
  beginner: 'Beginner',
  basic: 'Basic',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
} as const satisfies Record<Level, string>

export const LESSON_TIER_LABELS = {
  foundations: 'Foundations',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
} as const satisfies Record<LessonTier, string>

export const ROLE_LABELS = {
  respondent: 'Student',
  facilitator: 'Facilitator',
  admin: 'Admin',
} as const satisfies Record<Role, string>
