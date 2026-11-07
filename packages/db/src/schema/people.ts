import { YEAR_LEVELS } from '@digibridge/shared'
import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { authUsers } from 'drizzle-orm/supabase'
import { modeEnum, roleEnum, sexEnum } from './enums'

// One row per Google account, created on the first API call after sign-in.
export const profiles = pgTable('profiles', {
  id: uuid('id')
    .primaryKey()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  fullName: text('full_name'),
  avatarUrl: text('avatar_url'),
  role: roleEnum('role').notNull().default('respondent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSignInAt: timestamp('last_sign_in_at', { withTimezone: true }).notNull().defaultNow(),
}).enableRLS()

// A student taking the assessment, online (linked to a profile) or on a kiosk (no profile).
// Keyed by student number, so the one-attempt rule holds across both modes.
export const respondents = pgTable(
  'respondents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Unique allows many nulls in Postgres, so kiosk respondents don't clash.
    profileId: uuid('profile_id')
      .unique()
      .references(() => profiles.id, { onDelete: 'set null' }),
    studentNumber: text('student_number').notNull().unique(),
    fullName: text('full_name').notNull(),
    course: text('course').notNull(),
    yearLevel: smallint('year_level').notNull(),
    age: smallint('age').notNull(),
    sex: sexEnum('sex').notNull(),
    devices: text('devices')
      .array()
      .notNull()
      .default(sql`'{}'`),
    internetAccess: text('internet_access')
      .array()
      .notNull()
      .default(sql`'{}'`),
    showIdentity: boolean('show_identity').notNull().default(false),
    mode: modeEnum('mode').notNull(),
    consentVersion: text('consent_version').notNull(),
    consentedAt: timestamp('consented_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('respondents_student_number_upper', sql`${t.studentNumber} = upper(${t.studentNumber})`),
    check(
      'respondents_year_level_range',
      sql`${t.yearLevel} between ${sql.raw(String(YEAR_LEVELS[0]))} and ${sql.raw(String(YEAR_LEVELS.at(-1)))}`,
    ),
    index('respondents_course_year_level_idx').on(t.course, t.yearLevel),
  ],
).enableRLS()

// A tablet or laptop a facilitator has locked into kiosk mode.
export const kioskSessions = pgTable('kiosk_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Null once the facilitator's account is deleted; the session and its attempts stay.
  facilitatorId: uuid('facilitator_id').references(() => profiles.id, { onDelete: 'set null' }),
  deviceLabel: text('device_label').notNull(),
  pinHash: text('pin_hash').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
}).enableRLS()
