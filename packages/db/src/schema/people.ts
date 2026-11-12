import { AGE_MAX, AGE_MIN, PROFILE_TIME_ZONE, YEAR_LEVELS, type Mode } from '@digibridge/shared'
import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { authUsers } from 'drizzle-orm/supabase'
import { modeEnum, roleEnum, sexEnum } from './enums'

// Mode values for the school fields check, typed against MODES so renaming one breaks the build.
const modeLiteral = (mode: Mode) => sql.raw(`'${mode}'`)

// The calendar day of a timestamp in the Philippines, where respondents' ages are counted.
const consentDay = (column: AnyPgColumn) =>
  sql`(${column} at time zone ${sql.raw(`'${PROFILE_TIME_ZONE}'`)})::date`

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

// Someone taking the assessment, online (linked to a profile) or through a school link (no
// profile). Online rows are keyed by profile, school rows by student number. School details
// (student number, course, year level), the respondent token and the link they joined through
// are school only; the mode check enforces it.
export const respondents = pgTable(
  'respondents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Unique allows many nulls in Postgres, so school rows (no profile) and
    // online rows (no student number) don't clash.
    profileId: uuid('profile_id')
      .unique()
      .references(() => profiles.id, { onDelete: 'set null' }),
    studentNumber: text('student_number').unique(),
    fullName: text('full_name').notNull(),
    course: text('course'),
    yearLevel: smallint('year_level'),
    // Sent and read as 'YYYY-MM-DD'. Age is worked out from it (ageOn in packages/shared).
    birthDate: date('birth_date', { mode: 'string' }).notNull(),
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
    // SHA-256 of the token a school-link student's browser keeps in place of a Google sign-in.
    accessTokenHash: text('access_token_hash').unique(),
    // The school link the student joined through (LNK-05): they count against its limit from the
    // moment the profile is saved, and their attempt records it too.
    schoolLinkId: uuid('school_link_id').references((): AnyPgColumn => schoolLinks.id),
    mode: modeEnum('mode').notNull(),
    consentVersion: text('consent_version').notNull(),
    consentedAt: timestamp('consented_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('respondents_student_number_upper', sql`${t.studentNumber} = upper(${t.studentNumber})`),
    // Age on the day of consent, in the Philippines, from AGE_MIN to AGE_MAX: born on or before
    // that day AGE_MIN years ago, and after that day AGE_MAX + 1 years ago.
    check(
      'respondents_birth_date_range',
      sql`${t.birthDate} <= ${consentDay(t.consentedAt)} - interval '${sql.raw(String(AGE_MIN))} years'
        and ${t.birthDate} > ${consentDay(t.consentedAt)} - interval '${sql.raw(String(AGE_MAX + 1))} years'`,
    ),
    check(
      'respondents_year_level_range',
      sql`${t.yearLevel} between ${sql.raw(String(YEAR_LEVELS[0]))} and ${sql.raw(String(YEAR_LEVELS.at(-1)))}`,
    ),
    // No profile_id check for online: it turns null when the account is deleted.
    check(
      'respondents_school_fields_by_mode',
      sql`(${t.mode} = ${modeLiteral('school')} and ${t.studentNumber} is not null and ${t.course} is not null
          and ${t.yearLevel} is not null and ${t.profileId} is null and ${t.accessTokenHash} is not null
          and ${t.schoolLinkId} is not null)
        or (${t.mode} = ${modeLiteral('online')} and ${t.studentNumber} is null and ${t.course} is null
          and ${t.yearLevel} is null and ${t.accessTokenHash} is null and ${t.schoolLinkId} is null)`,
    ),
    // Each link's response count (its respondents), and the dashboard's school link filter.
    index('respondents_school_link_id_idx').on(t.schoolLinkId),
    // School rows only: online rows have no course. A query on course = X still uses it.
    index('respondents_course_year_level_idx')
      .on(t.course, t.yearLevel)
      .where(sql`${t.course} is not null`),
  ],
).enableRLS()

// A link an admin makes for a class (LNK-01). Students open /s/<code> without signing in.
// Its status (open, closed, expired, full) is worked out when read: see linkStatus in
// packages/shared.
export const schoolLinks = pgTable(
  'school_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    school: text('school').notNull(),
    label: text('label').notNull(),
    // Null once the admin's account is deleted; the link and its attempts stay.
    createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
    // Null for any course and any year level.
    course: text('course'),
    yearLevel: smallint('year_level'),
    // Null for no limit.
    maxResponses: integer('max_responses'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'school_links_year_level_range',
      sql`${t.yearLevel} between ${sql.raw(String(YEAR_LEVELS[0]))} and ${sql.raw(String(YEAR_LEVELS.at(-1)))}`,
    ),
    check('school_links_max_responses_positive', sql`${t.maxResponses} > 0`),
  ],
).enableRLS()
