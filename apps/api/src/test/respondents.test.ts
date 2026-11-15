import { respondents } from '@digibridge/db'
import {
  AGE_MAX,
  AGE_MIN,
  COURSES,
  ONLINE_CONSENT_NOTICE,
  STUDENT_NUMBER_EXAMPLE,
  YEAR_LEVELS,
} from '@digibridge/shared'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { app } from '../app'
import { env, signedIn, testDb } from './helpers'
import { get } from './fixtures'

describe('POST /api/v1/respondents', () => {
  const profile = {
    fullName: '  Juan Dela Cruz ',
    birthDate: '2007-06-15',
    sex: 'male',
    devices: ['smartphone', 'laptop'],
    internetAccess: ['mobile_data'],
    showIdentity: false,
    consentVersion: ONLINE_CONSENT_NOTICE.version,
  }
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    app.request(
      '/api/v1/respondents',
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      env,
    )
  const respondentsOf = (profileId: string) =>
    testDb.select().from(respondents).where(eq(respondents.profileId, profileId))

  it('saves consent, the general profile and the identity choice', async () => {
    const user = await signedIn()
    const before = Date.now()
    const res = await post(profile, user.headers)
    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: string; fullName: string }
    expect(body).toEqual({ id: expect.any(String), fullName: 'Juan Dela Cruz' })

    const [row] = await respondentsOf(user.id)
    expect(row).toMatchObject({
      id: body.id,
      mode: 'online',
      fullName: 'Juan Dela Cruz',
      birthDate: '2007-06-15',
      sex: 'male',
      devices: ['smartphone', 'laptop'],
      internetAccess: ['mobile_data'],
      showIdentity: false,
      consentVersion: ONLINE_CONSENT_NOTICE.version,
      studentNumber: null,
      course: null,
      yearLevel: null,
    })
    expect(row!.consentedAt.getTime()).toBeGreaterThanOrEqual(before - 1000)

    // The next /me knows the respondent, so the web app moves past the profile step.
    expect(await (await get('/api/v1/me', user.headers)).json()).toMatchObject({
      respondent: { id: body.id, fullName: 'Juan Dela Cruz' },
    })
  })

  it.each(['facilitator', 'admin'] as const)(
    'refuses %s accounts and saves nothing, so staff tries stay out of the data',
    async (role) => {
      const user = await signedIn(role)
      const res = await post(profile, user.headers)
      expect(res.status).toBe(403)
      expect(await res.json()).toMatchObject({ error: { code: 'forbidden' } })
      expect(await respondentsOf(user.id)).toHaveLength(0)
    },
  )

  it('sends unauthorized without a token', async () => {
    expect((await post(profile)).status).toBe(401)
  })

  it.each([
    ['studentNumber', STUDENT_NUMBER_EXAMPLE],
    ['course', COURSES[0]],
    ['yearLevel', YEAR_LEVELS[0]],
  ])('refuses the school field %s and saves nothing (PRO-06)', async (field, value) => {
    const user = await signedIn()
    const res = await post({ ...profile, [field]: value }, user.headers)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: {
        code: 'validation_failed',
        message: "Your answers include a question this form doesn't ask.",
      },
    })
    expect(await respondentsOf(user.id)).toHaveLength(0)
  })

  it('refuses a profile without the identity choice (PRO-05)', async () => {
    const user = await signedIn()
    const { showIdentity: _, ...withoutChoice } = profile
    const res = await post(withoutChoice, user.headers)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: { message: 'Choose whether the DigiBridge team may see your name.' },
    })
  })

  it.each([
    ['a date that does not exist', '2007-02-30', 'That date doesn’t exist'],
    ['someone too young', '2025-01-01', `${AGE_MIN} to ${AGE_MAX} years old`],
    ['no date', undefined, 'Enter your date of birth.'],
  ])('refuses %s as the birth date', async (_, birthDate, message) => {
    const user = await signedIn()
    const res = await post({ ...profile, birthDate }, user.headers)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: { code: 'validation_failed', message: expect.stringContaining(message) },
    })
    expect(await respondentsOf(user.id)).toHaveLength(0)
  })

  it.each([
    ['one word', 'Juan', 'Enter your first and last name.'],
    ['numbers', 'Juan 2 Cruz', 'Use letters only.'],
  ])('refuses a full name with %s', async (_, fullName, message) => {
    const user = await signedIn()
    const res = await post({ ...profile, fullName }, user.headers)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: { code: 'validation_failed', message: expect.stringContaining(message) },
    })
  })

  it('refuses consent to an old notice (CON-02)', async () => {
    const user = await signedIn()
    const res = await post({ ...profile, consentVersion: 'online-0' }, user.headers)
    expect(res.status).toBe(400)
    expect(await respondentsOf(user.id)).toHaveLength(0)
  })

  it('sends conflict when the account already has a respondent (PRO-07)', async () => {
    const user = await signedIn()
    expect((await post(profile, user.headers)).status).toBe(201)
    const res = await post({ ...profile, fullName: 'Someone Else' }, user.headers)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: { code: 'conflict', message: 'You already filled in your profile.' },
    })
    expect(await respondentsOf(user.id)).toMatchObject([{ fullName: 'Juan Dela Cruz' }])
  })

  it('saves one respondent when two arrive together', async () => {
    const user = await signedIn()
    const statuses = (
      await Promise.all([post(profile, user.headers), post(profile, user.headers)])
    ).map((res) => res.status)
    expect(statuses.sort()).toEqual([201, 409])
    expect(await respondentsOf(user.id)).toHaveLength(1)
  })
})
