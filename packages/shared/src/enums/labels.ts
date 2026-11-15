import type { Difficulty, LessonTier, Level, Mode, Role, Sex, VoidReason } from './values'

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

/** How a respondent came in, for the team's pages. */
export const MODE_LABELS = {
  online: 'Online',
  school: 'School link',
} as const satisfies Record<Mode, string>

export const DIFFICULTY_LABELS = {
  basic: 'Basic',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
} as const satisfies Record<Difficulty, string>

/** Why an attempt was voided, for the team's pages. */
export const VOID_REASON_LABELS = {
  technical: 'Technical problem',
  wrong_person: 'Wrong person took it',
  duplicate: 'Took it more than once',
  retake_requested: 'Asked to retake',
  test_entry: 'Test or practice entry',
  not_eligible: 'Not part of the study’s group',
  other: 'Other',
} as const satisfies Record<VoidReason, string>
