// The database's own checks, on rows inserted straight into it.
import { attempts, respondents } from '@digibridge/db'
import { AGE_MAX, AGE_MIN, toIsoDate } from '@digibridge/shared'
import { afterAll, describe, expect, it } from 'vitest'
import { clearQuestionBank, signedIn, testDb, addSchoolLink } from './helpers'
import { base, school, voidedFields } from './fixtures'

// The Postgres error sits under Drizzle's wrapper, as `cause`.
const insertError = async (values: typeof respondents.$inferInsert) => {
  try {
    await testDb.insert(respondents).values(values)
  } catch (error) {
    return (error as { cause?: { constraint?: string } }).cause?.constraint
  }
}

describe('respondents_school_fields_by_mode', () => {
  it('takes a school row with school details, a token and a link, and an online row without', async () => {
    const user = await signedIn()
    const link = await addSchoolLink()
    expect(
      await insertError({ ...base, ...school, schoolLinkId: link.id, mode: 'school' }),
    ).toBeUndefined()
    expect(await insertError({ ...base, mode: 'online', profileId: user.id })).toBeUndefined()
  })

  it.each([
    ['without a student number', { studentNumber: null }],
    ['without a course', { course: null }],
    ['without a year level', { yearLevel: null }],
    ['without a token', { accessTokenHash: null }],
    ['without a link', { schoolLinkId: null }],
  ])('refuses a school row %s', async (_, fields) => {
    const link = await addSchoolLink()
    expect(
      await insertError({ ...base, ...school, schoolLinkId: link.id, ...fields, mode: 'school' }),
    ).toBe('respondents_school_fields_by_mode')
  })

  it('refuses a school row linked to a profile', async () => {
    const user = await signedIn()
    const link = await addSchoolLink()
    expect(
      await insertError({
        ...base,
        ...school,
        schoolLinkId: link.id,
        mode: 'school',
        profileId: user.id,
      }),
    ).toBe('respondents_school_fields_by_mode')
  })

  it.each([
    ['a student number', () => ({ studentNumber: school.studentNumber })],
    ['a course', () => ({ course: school.course })],
    ['a year level', () => ({ yearLevel: school.yearLevel })],
    ['a token', () => ({ accessTokenHash: school.accessTokenHash })],
    ['a link', async () => ({ schoolLinkId: (await addSchoolLink()).id })],
  ])('refuses an online row with %s', async (_, fields) => {
    const user = await signedIn()
    expect(
      await insertError({ ...base, ...(await fields()), mode: 'online', profileId: user.id }),
    ).toBe('respondents_school_fields_by_mode')
  })
})

describe('attempts void checks', () => {
  afterAll(clearQuestionBank)

  it('needs a reason and time on a voided attempt, a note with other, and none otherwise', async () => {
    const [row] = await testDb
      .insert(respondents)
      .values({
        profileId: (await signedIn()).id,
        fullName: 'Juan Dela Cruz',
        birthDate: '2007-06-15',
        sex: 'male',
        mode: 'online',
        consentVersion: '1',
        consentedAt: new Date(),
      })
      .returning({ id: respondents.id })
    const add = (values: Partial<typeof attempts.$inferInsert>) =>
      testDb.insert(attempts).values({
        respondentId: row!.id,
        expiresAt: new Date(),
        questionOrder: [],
        choiceOrder: {},
        ...values,
      })
    await expect(add({ status: 'voided' })).rejects.toThrow()
    await expect(add({ ...voidedFields(), voidReasonCode: 'other' })).rejects.toThrow()
    await expect(add({ status: 'submitted', voidReason: 'Note' })).rejects.toThrow()
    await expect(
      add({ ...voidedFields(), voidReasonCode: 'other', voidReason: 'Note' }),
    ).resolves.toBeDefined()
  })
})

describe('respondents_birth_date_range', () => {
  // Noon on Nov 8, 2026 in Manila (UTC+8). The check counts age on the day of consent there.
  const consentedAt = new Date('2026-11-08T04:00:00Z')
  const row = (birthDate: string, profileId: string) =>
    ({ ...base, birthDate, consentedAt, mode: 'online', profileId }) as const

  it.each([
    ['turned AGE_MIN that day', toIsoDate(2026 - AGE_MIN, 11, 8)],
    ['is a day short of AGE_MAX + 1', toIsoDate(2026 - AGE_MAX - 1, 11, 9)],
  ])('takes someone who %s', async (_, birthDate) => {
    const user = await signedIn()
    expect(await insertError(row(birthDate, user.id))).toBeUndefined()
  })

  it.each([
    ['is a day short of AGE_MIN', toIsoDate(2026 - AGE_MIN, 11, 9)],
    ['turned AGE_MAX + 1 that day', toIsoDate(2026 - AGE_MAX - 1, 11, 8)],
    ['is born after consenting', '2026-11-09'],
  ])('refuses someone who %s', async (_, birthDate) => {
    const user = await signedIn()
    expect(await insertError(row(birthDate, user.id))).toBe('respondents_birth_date_range')
  })

  it('counts the day in the Philippines, not UTC', async () => {
    // 4:30 PM UTC on Nov 7 is already Nov 8 in Manila, so this person just turned AGE_MIN.
    const user = await signedIn()
    const lateUtc = new Date('2026-11-07T16:30:00Z')
    expect(
      await insertError({
        ...row(toIsoDate(2026 - AGE_MIN, 11, 8), user.id),
        consentedAt: lateUtc,
      }),
    ).toBeUndefined()
  })
})
