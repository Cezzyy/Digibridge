// The SQL seeds in packages/db/seed, loaded as the team runs them.
import { choices, competencyAreas, lessons, questions } from '@digibridge/db'
import {
  AREA_CODES,
  CHOICES_PER_QUESTION,
  ITEMS_PER_ATTEMPT,
  LESSON_TIERS,
  lessonResourceSchema,
  lessonSlugSchema,
  MIN_SCENARIO_ITEMS_PER_AREA,
} from '@digibridge/shared'
import { and, eq, sql } from 'drizzle-orm'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { clearQuestionBank, testDb } from './helpers'
import { respondent, start, attemptsOf } from './fixtures'

describe('dev question bank (packages/db/seed/dev-questions.sql)', () => {
  const SEED = fileURLToPath(
    new URL('../../../../packages/db/seed/dev-questions.sql', import.meta.url).href,
  )
  const loadSeed = async () => testDb.$client.exec(await readFile(SEED, 'utf8'))

  beforeEach(clearQuestionBank)
  afterAll(clearQuestionBank)

  it('loads 5 basic, 5 intermediate and 3 advanced items per area, each with 4 choices and 1 right', async () => {
    await loadSeed()
    // Running it again adds nothing.
    await loadSeed()

    const rows = await testDb
      .select({
        area: competencyAreas.code,
        difficulty: questions.difficulty,
        isScenario: questions.isScenario,
        choices: sql<number>`count(${choices.id})::int`,
        right: sql<number>`count(*) filter (where ${choices.isCorrect})::int`,
      })
      .from(questions)
      .innerJoin(competencyAreas, eq(competencyAreas.id, questions.areaId))
      .innerJoin(choices, eq(choices.questionId, questions.id))
      .groupBy(questions.id, competencyAreas.code)
    expect(rows).toHaveLength(39)
    for (const row of rows) expect(row).toMatchObject({ choices: CHOICES_PER_QUESTION, right: 1 })
    for (const area of AREA_CODES) {
      const ofArea = rows.filter((r) => r.area === area)
      const count = (d: string) => ofArea.filter((r) => r.difficulty === d).length
      expect([count('basic'), count('intermediate'), count('advanced')]).toEqual([5, 5, 3])
      expect(ofArea.filter((r) => r.isScenario).length).toBeGreaterThanOrEqual(
        MIN_SCENARIO_ITEMS_PER_AREA,
      )
    }
  })

  it('fills an attempt', async () => {
    await loadSeed()
    const user = await respondent()
    expect((await start(user.headers)).status).toBe(201)
    const [attempt] = await attemptsOf(user.respondentId)
    expect(attempt!.questionOrder).toHaveLength(ITEMS_PER_ATTEMPT)
  })
})

describe('starter lessons (packages/db/seed/lessons.sql)', () => {
  const seed = (name: string) =>
    fileURLToPath(new URL(`../../../../packages/db/seed/${name}`, import.meta.url).href)
  const load = async (name: string) => testDb.$client.exec(await readFile(seed(name), 'utf8'))

  beforeEach(clearQuestionBank)
  afterAll(clearQuestionBank)

  it('refuses to run before the areas are loaded', async () => {
    await expect(load('lessons.sql')).rejects.toThrow(/dev-questions\.sql/)
    // The SQL editor ends the failed transaction by itself; PGlite needs telling.
    await testDb.$client.exec('rollback')
  })

  it('publishes one lesson per area and tier, each with a valid slug and resources (LES-01)', async () => {
    await load('dev-questions.sql')
    await load('lessons.sql')
    // Running it again adds nothing.
    await load('lessons.sql')

    const rows = await testDb
      .select({
        area: competencyAreas.code,
        tier: lessons.tier,
        slug: lessons.slug,
        isPublished: lessons.isPublished,
        resources: lessons.resources,
        bodyMd: lessons.bodyMd,
      })
      .from(lessons)
      .innerJoin(competencyAreas, eq(competencyAreas.id, lessons.areaId))
    expect(rows).toHaveLength(AREA_CODES.length * LESSON_TIERS.length)
    for (const area of AREA_CODES) {
      expect(
        rows
          .filter((r) => r.area === area)
          .map((r) => r.tier)
          .sort(),
      ).toEqual([...LESSON_TIERS].sort())
    }
    for (const row of rows) {
      expect(row.isPublished).toBe(true)
      expect(lessonSlugSchema.safeParse(row.slug).success).toBe(true)
      expect(row.resources.length).toBeGreaterThan(0)
      for (const resource of row.resources) {
        expect(lessonResourceSchema.safeParse(resource).success).toBe(true)
      }
      // The page shows the title, so a body starts at its first section.
      expect(row.bodyMd).toMatch(/^## /)
    }
  })

  it('leaves out a lesson whose area and tier already have a published one', async () => {
    await load('dev-questions.sql')
    const [area] = await testDb
      .select({ id: competencyAreas.id })
      .from(competencyAreas)
      .where(eq(competencyAreas.code, 'safety'))
    await testDb.insert(lessons).values({
      slug: 'team-lesson',
      areaId: area!.id,
      tier: 'foundations',
      title: 'The team’s own',
      summary: 'Written by the team',
      bodyMd: '## Hi',
      isPublished: true,
    })
    await load('lessons.sql')
    const published = await testDb
      .select({ slug: lessons.slug })
      .from(lessons)
      .where(and(eq(lessons.areaId, area!.id), eq(lessons.tier, 'foundations')))
    expect(published).toEqual([{ slug: 'team-lesson' }])
    expect(await testDb.$count(lessons)).toBe(AREA_CODES.length * LESSON_TIERS.length)
  })
})
