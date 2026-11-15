// Requests and rows that more than one route test file uses. The test database, school links and
// sign-in tokens are in helpers.ts.
import type { lessons } from '@digibridge/db'
import { attempts, choices, competencyAreas, respondents } from '@digibridge/db'
import { COURSES, STUDENT_NUMBER_EXAMPLE, YEAR_LEVELS } from '@digibridge/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach } from 'vitest'
import { app } from '../app'
import { addQuestionBank, addSchoolLink, clearQuestionBank, env, signedIn, testDb } from './helpers'

// ---- Requests ----

export const json = { 'Content-Type': 'application/json' }

export const get = (path: string, headers: Record<string, string> = {}) =>
  app.request(path, { headers }, env)

/** A request with a JSON body, if there is one. */
export const send = (
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: unknown,
) =>
  app.request(
    path,
    {
      method,
      headers: { ...headers, ...json },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env,
  )

/**
 * The question bank before each test of the file or describe it's called in. clearAccounts
 * empties questions too (questions.created_by points at profiles, so its cascade reaches them),
 * but leaves the areas.
 */
export function useQuestionBank() {
  beforeEach(async () => {
    await clearQuestionBank()
    await addQuestionBank()
  })
  afterAll(clearQuestionBank)
}

// ---- Respondents ----

/** A respondent who has agreed to the notice and saved their profile. */
export const respondent = async () => {
  const user = await signedIn()
  const [row] = await testDb
    .insert(respondents)
    .values({
      profileId: user.id,
      fullName: 'Juan Dela Cruz',
      birthDate: '2007-06-15',
      sex: 'male',
      mode: 'online',
      consentVersion: '1',
      consentedAt: new Date(),
    })
    .returning({ id: respondents.id })
  return { ...user, respondentId: row!.id }
}

// Respondent rows inserted straight into the database.
export const base = {
  fullName: 'Juan Dela Cruz',
  birthDate: '2007-06-15',
  sex: 'male',
  consentVersion: '1',
  consentedAt: new Date(),
} as const
export const school = {
  studentNumber: STUDENT_NUMBER_EXAMPLE,
  course: COURSES[0],
  yearLevel: YEAR_LEVELS[0],
  accessTokenHash: 'a'.repeat(64),
}

export const linkFor = (label: string) => addSchoolLink({ label })

/**
 * A school respondent, straight into the database, with an attempt in the given state. They
 * joined through the attempt's link, or else a link of their own.
 */
let studentNumber = 2000
export const addSchoolRespondent = async (
  values: Partial<typeof respondents.$inferInsert>,
  attempt?: {
    status: 'in_progress' | 'submitted' | 'expired' | 'voided'
    linkId: string
    pct?: number
  },
) => {
  const [row] = await testDb
    .insert(respondents)
    .values({
      ...base,
      ...school,
      studentNumber: `C23-01-${++studentNumber}-MAN121`,
      accessTokenHash: crypto.randomUUID(),
      mode: 'school',
      ...values,
      schoolLinkId: values.schoolLinkId ?? attempt?.linkId ?? (await linkFor('Not started')).id,
    })
    .returning()
  let attemptId: string | null = null
  if (attempt) {
    const finished = attempt.status === 'submitted' || attempt.status === 'expired'
    const [inserted] = await testDb
      .insert(attempts)
      .values({
        respondentId: row!.id,
        schoolLinkId: attempt.linkId,
        ...withStatus(attempt.status),
        expiresAt: new Date(Date.now() + 25 * 60_000),
        submittedAt: finished ? new Date() : null,
        overallPct: attempt.pct ?? null,
        overallLevel: attempt.pct === undefined ? null : 'basic',
        totalPoints: attempt.pct === undefined ? null : 20,
        questionOrder: [],
        choiceOrder: {},
      })
      .returning({ id: attempts.id })
    attemptId = inserted!.id
  }
  return { ...row!, attemptId }
}

// ---- Attempts ----

/** The fields of a voided attempt, for setting one up straight in the database. */
export const voidedFields = () => ({
  status: 'voided' as const,
  voidReasonCode: 'technical' as const,
  voidedAt: new Date(),
})
/** An attempt's status, with the void fields a voided one needs. */
export const withStatus = (status: 'in_progress' | 'submitted' | 'expired' | 'voided') =>
  status === 'voided' ? voidedFields() : { status }

export const start = (headers: Record<string, string> = {}) =>
  app.request('/api/v1/attempts', { method: 'POST', headers }, env)
export const attemptsOf = (respondentId: string) =>
  testDb.select().from(attempts).where(eq(attempts.respondentId, respondentId))

export const read = (id: string, headers: Record<string, string> = {}) =>
  get(`/api/v1/attempts/${id}`, headers)
export const save = (
  id: string,
  questionId: string,
  choiceId: string,
  headers: Record<string, string>,
) =>
  app.request(
    `/api/v1/attempts/${id}/answers/${questionId}`,
    { method: 'PUT', headers: { ...headers, ...json }, body: JSON.stringify({ choiceId }) },
    env,
  )
export const submit = (id: string, headers: Record<string, string> = {}) =>
  app.request(`/api/v1/attempts/${id}/submit`, { method: 'POST', headers }, env)

/** A respondent with a started attempt, and that attempt's row. */
export const started = async () => {
  const user = await respondent()
  await start(user.headers)
  const [attempt] = await attemptsOf(user.respondentId)
  return { user, attempt: attempt! }
}
export const choicesOf = (questionId: string) =>
  testDb.select().from(choices).where(eq(choices.questionId, questionId))
/** addQuestionBank makes position 0 the right choice. */
export const rightChoice = async (questionId: string) =>
  (await choicesOf(questionId)).find((c) => c.isCorrect)!.id
export const wrongChoice = async (questionId: string) =>
  (await choicesOf(questionId)).find((c) => !c.isCorrect)!.id
export const setExpiresAt = (attemptId: string, expiresAt: Date) =>
  testDb.update(attempts).set({ expiresAt }).where(eq(attempts.id, attemptId))

// ---- Lessons ----

export const areaId = async (code: string) =>
  (
    await testDb
      .select({ id: competencyAreas.id })
      .from(competencyAreas)
      .where(eq(competencyAreas.code, code))
  )[0]!.id

// One lesson row with every field set; `overrides` picks its area, tier and the rest.
export const lessonRow = async (
  slug: string,
  area: string,
  tier: 'foundations' | 'intermediate' | 'advanced',
  overrides: Partial<typeof lessons.$inferInsert> = {},
) => ({
  slug,
  areaId: await areaId(area),
  tier,
  title: `Title of ${slug}`,
  summary: `Summary of ${slug}`,
  bodyMd: `## ${slug}`,
  isPublished: true,
  ...overrides,
})
