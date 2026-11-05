import { sql } from 'drizzle-orm'
import {
  check,
  index,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { choices, competencyAreas, questions } from './content'
import { attemptStatusEnum, levelEnum } from './enums'
import { kioskSessions, profiles, respondents } from './people'

// Question ID -> choice IDs in the order shown to the respondent.
export type ChoiceOrder = Record<string, string[]>

export const attempts = pgTable(
  'attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    respondentId: uuid('respondent_id')
      .notNull()
      .references(() => respondents.id, { onDelete: 'cascade' }),
    kioskSessionId: uuid('kiosk_session_id').references(() => kioskSessions.id),
    status: attemptStatusEnum('status').notNull().default('in_progress'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    questionOrder: uuid('question_order').array().notNull(),
    choiceOrder: jsonb('choice_order').$type<ChoiceOrder>().notNull(),
    totalPoints: smallint('total_points'),
    overallPct: numeric('overall_pct', { precision: 5, scale: 2, mode: 'number' }),
    overallLevel: levelEnum('overall_level'),
    resultsToken: text('results_token').unique(),
    voidReason: text('void_reason'),
    voidedBy: uuid('voided_by').references(() => profiles.id, { onDelete: 'set null' }),
  },
  (t) => [
    // One attempt per respondent; voiding frees the slot for a retake.
    uniqueIndex('attempts_one_per_respondent_idx')
      .on(t.respondentId)
      .where(sql`${t.status} <> 'voided'`),
    index('attempts_status_submitted_at_idx').on(t.status, t.submittedAt),
  ],
).enableRLS()

// Primary key (attempt, question), so a changed answer overwrites the old one.
export const answers = pgTable(
  'answers',
  {
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id),
    choiceId: uuid('choice_id')
      .notNull()
      .references(() => choices.id),
    points: smallint('points'),
    answeredAt: timestamp('answered_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.attemptId, t.questionId] }),
    index('answers_question_id_idx').on(t.questionId),
  ],
).enableRLS()

// Written once at submit, one row per area.
export const areaResults = pgTable(
  'area_results',
  {
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id, { onDelete: 'cascade' }),
    areaId: uuid('area_id')
      .notNull()
      .references(() => competencyAreas.id),
    points: smallint('points').notNull(),
    maxPoints: smallint('max_points').notNull(),
    pct: numeric('pct', { precision: 5, scale: 2, mode: 'number' }).notNull(),
    level: levelEnum('level').notNull(),
  },
  (t) => [primaryKey({ columns: [t.attemptId, t.areaId] })],
).enableRLS()

const susAnswer = (name: string) => smallint(name).notNull()

// One SUS response per attempt. Answers are 1 to 5; the score is 0 to 100 in steps of 2.5.
export const susResponses = pgTable(
  'sus_responses',
  {
    attemptId: uuid('attempt_id')
      .primaryKey()
      .references(() => attempts.id, { onDelete: 'cascade' }),
    q1: susAnswer('q1'),
    q2: susAnswer('q2'),
    q3: susAnswer('q3'),
    q4: susAnswer('q4'),
    q5: susAnswer('q5'),
    q6: susAnswer('q6'),
    q7: susAnswer('q7'),
    q8: susAnswer('q8'),
    q9: susAnswer('q9'),
    q10: susAnswer('q10'),
    score: numeric('score', { precision: 4, scale: 1, mode: 'number' }).notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'sus_responses_answers_range',
      sql`least(${t.q1}, ${t.q2}, ${t.q3}, ${t.q4}, ${t.q5}, ${t.q6}, ${t.q7}, ${t.q8}, ${t.q9}, ${t.q10}) >= 1
        and greatest(${t.q1}, ${t.q2}, ${t.q3}, ${t.q4}, ${t.q5}, ${t.q6}, ${t.q7}, ${t.q8}, ${t.q9}, ${t.q10}) <= 5`,
    ),
    check('sus_responses_score_range', sql`${t.score} between 0 and 100`),
  ],
).enableRLS()
