import {
  ATTEMPT_STATUSES,
  DIFFICULTIES,
  LESSON_TIERS,
  LEVELS,
  MODES,
  ROLES,
  SEXES,
  VOID_REASONS,
} from '@digibridge/shared'
import { pgEnum } from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('role', ROLES)
export const modeEnum = pgEnum('mode', MODES)
export const sexEnum = pgEnum('sex', SEXES)
export const difficultyEnum = pgEnum('difficulty', DIFFICULTIES)
export const levelEnum = pgEnum('level', LEVELS)
export const lessonTierEnum = pgEnum('lesson_tier', LESSON_TIERS)
export const attemptStatusEnum = pgEnum('attempt_status', ATTEMPT_STATUSES)
export const voidReasonEnum = pgEnum('void_reason', VOID_REASONS)
