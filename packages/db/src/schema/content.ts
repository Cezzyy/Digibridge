import { CHOICES_PER_QUESTION, type LessonResource } from '@digibridge/shared'
import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { difficultyEnum, lessonTierEnum } from './enums'
import { profiles } from './people'

// The 3 DigComp areas: info_literacy, communication, safety.
export const competencyAreas = pgTable('competency_areas', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  sortOrder: smallint('sort_order').notNull().default(0),
}).enableRLS()

// Never hard-deleted once answered (answers block it); set isActive false instead.
export const questions = pgTable('questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  areaId: uuid('area_id')
    .notNull()
    .references(() => competencyAreas.id),
  difficulty: difficultyEnum('difficulty').notNull(),
  stem: text('stem').notNull(),
  imageUrl: text('image_url'),
  isScenario: boolean('is_scenario').notNull().default(false),
  explanation: text('explanation'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}).enableRLS()

// CHOICES_PER_QUESTION per question, at positions 0 to CHOICES_PER_QUESTION - 1, exactly 1 correct.
export const choices = pgTable(
  'choices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    isCorrect: boolean('is_correct').notNull().default(false),
    position: smallint('position').notNull(),
  },
  (t) => [
    unique('choices_question_position_unique').on(t.questionId, t.position),
    // Target of the answers foreign key that keeps a choice on its own question.
    unique('choices_question_id_unique').on(t.questionId, t.id),
    uniqueIndex('choices_one_correct_idx')
      .on(t.questionId)
      .where(sql`${t.isCorrect}`),
    check(
      'choices_position_range',
      sql`${t.position} between 0 and ${sql.raw(String(CHOICES_PER_QUESTION - 1))}`,
    ),
  ],
).enableRLS()

export const lessons = pgTable(
  'lessons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    areaId: uuid('area_id')
      .notNull()
      .references(() => competencyAreas.id),
    tier: lessonTierEnum('tier').notNull(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    bodyMd: text('body_md').notNull(),
    imageUrl: text('image_url'),
    videoUrl: text('video_url'),
    resources: jsonb('resources')
      .$type<LessonResource[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    isPublished: boolean('is_published').notNull().default(false),
    sortOrder: smallint('sort_order').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // The 9-lesson set: 1 published lesson per area and tier (LES-01).
    uniqueIndex('lessons_one_published_per_tier_idx')
      .on(t.areaId, t.tier)
      .where(sql`${t.isPublished}`),
  ],
).enableRLS()
