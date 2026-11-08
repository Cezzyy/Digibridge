import { attempts, profiles, respondents } from '@digibridge/db'
import {
  AGE_MAX,
  AGE_MIN,
  toIsoDate,
  COURSES,
  ONLINE_CONSENT_NOTICE,
  STUDENT_NUMBER_EXAMPLE,
  YEAR_LEVELS,
} from '@digibridge/shared'
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { eq } from 'drizzle-orm'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import { generateKeyPair } from 'jose'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { app } from './app'
import type { AppEnv } from './env'
import {
  ApiError,
  auth,
  dbMiddleware,
  handleError,
  handleNotFound,
  requireRole,
  validationHook,
} from './middleware'
import {
  ADMIN_EMAIL,
  WEB_ORIGIN,
  addAuthUser,
  bearer,
  clearAccounts,
  env,
  serveTestJwks,
  setUpDatabase,
  signedIn,
  testDb,
  tokenFor,
} from './test-helpers'

// Every request gets the in-memory test database instead of Hyperdrive.
vi.mock('./config/db', async () => {
  const { testDb } = await import('./test-helpers')
  return { createDb: () => testDb }
})

// Starting PGlite and running the migrations takes a few seconds, more when
// `pnpm check` runs every package at once, so allow longer than the 10 s default.
beforeAll(async () => {
  await setUpDatabase()
  serveTestJwks()
}, 60_000)
afterEach(clearAccounts)

const get = (path: string, headers: Record<string, string> = {}) =>
  app.request(path, { headers }, env)

describe('GET /api/v1/health', () => {
  it('answers ok', async () => {
    const res = await get('/api/v1/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})

describe('errors', () => {
  it('sends not_found for an unknown route', async () => {
    const res = await get('/api/v1/nope')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({
      error: { code: 'not_found', message: expect.any(String) },
    })
  })

  // A stand-in app with the same error setup as app.ts and routes that fail on purpose.
  const echoRoute = createRoute({
    method: 'post',
    path: '/echo',
    request: {
      body: {
        content: {
          'application/json': { schema: z.object({ name: z.string().min(1, 'Enter your name') }) },
        },
      },
    },
    responses: { 200: { description: 'Echo' } },
  })
  const testApp = new OpenAPIHono<AppEnv>({ defaultHook: validationHook })
    .openapi(echoRoute, (c) => c.json(c.req.valid('json'), 200))
    .get('/conflict', () => {
      throw new ApiError('conflict', 'This student number already finished the assessment.')
    })
    .get('/crash', () => {
      throw new Error('boom')
    })
    .post('/upload', bodyLimit({ maxSize: 10 }), (c) => c.text('ok'))
    .get('/busy', () => {
      throw new HTTPException(429, {
        res: new Response(null, { headers: { 'Retry-After': '60' } }),
      })
    })
    .get('/down', () => {
      throw new HTTPException(503, { message: 'db down' })
    })
  testApp.onError(handleError)
  testApp.notFound(handleNotFound)

  const postJson = (body: string) =>
    testApp.request('/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

  it('sends validation_failed with the schema message for bad input', async () => {
    const res = await postJson(JSON.stringify({ name: '' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: { code: 'validation_failed', message: 'Enter your name' },
    })
  })

  it('sends the default message when the schema has none', async () => {
    const res = await postJson(JSON.stringify({}))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: {
        code: 'validation_failed',
        message: 'Some of the details sent are missing or not valid.',
      },
    })
  })

  it('sends bad_request for malformed JSON', async () => {
    const res = await postJson('{')
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: { code: 'bad_request' } })
  })

  it('sends the status and message of a thrown ApiError', async () => {
    const res = await testApp.request('/conflict')
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: { code: 'conflict', message: 'This student number already finished the assessment.' },
    })
  })

  it('hides the details of an unexpected error', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await testApp.request('/crash')
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body).toMatchObject({ error: { code: 'internal_error' } })
    expect(JSON.stringify(body)).not.toContain('boom')
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })

  it('sends too_large when the body is over the limit', async () => {
    const res = await testApp.request('/upload', { method: 'POST', body: 'x'.repeat(100) })
    expect(res.status).toBe(413)
    expect(await res.json()).toMatchObject({ error: { code: 'too_large' } })
  })

  it('keeps the status and headers of a thrown HTTPException', async () => {
    const res = await testApp.request('/busy')
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('60')
    expect(res.headers.get('Content-Type')).toContain('application/json')
    expect(await res.json()).toMatchObject({ error: { code: 'rate_limited' } })
  })

  it('keeps a 5xx status, hides its message and logs it', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await testApp.request('/down')
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body).toMatchObject({ error: { code: 'internal_error' } })
    expect(JSON.stringify(body)).not.toContain('db down')
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })
})

describe('CORS', () => {
  const preflight = (origin: string) =>
    app.request(
      '/api/v1/health',
      {
        method: 'OPTIONS',
        headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' },
      },
      env,
    )

  it('allows the web origin', async () => {
    const res = await preflight(WEB_ORIGIN)
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(WEB_ORIGIN)
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization')
  })

  it('refuses other origins', async () => {
    const res = await preflight('https://evil.example')
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('adds the header to error responses too', async () => {
    const res = await get('/api/v1/nope', { Origin: WEB_ORIGIN })
    expect(res.status).toBe(404)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(WEB_ORIGIN)
  })
})

describe('auth middleware', () => {
  const me = (headers: Record<string, string>) => get('/api/v1/me', headers)
  const profileOf = async (id: string) =>
    (await testDb.select().from(profiles).where(eq(profiles.id, id)))[0]

  it('sends unauthorized without a token', async () => {
    const res = await me({})
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      error: { code: 'unauthorized', message: 'Please sign in to continue.' },
    })
  })

  it('sends unauthorized for a header that is not a Bearer token', async () => {
    const res = await me({ Authorization: 'Basic abc' })
    expect(res.status).toBe(401)
  })

  it('sends unauthorized for a token signed with another key', async () => {
    const id = await addAuthUser()
    const { privateKey } = await generateKeyPair('ES256')
    const res = await me(bearer(await tokenFor(id, { key: privateKey })))
    expect(res.status).toBe(401)
  })

  it('sends unauthorized for a token from another Supabase project', async () => {
    const id = await addAuthUser()
    const token = await tokenFor(id, { issuer: 'https://other-project.supabase.co/auth/v1' })
    const res = await me(bearer(token))
    expect(res.status).toBe(401)
  })

  it('says so when the token has expired', async () => {
    const id = await addAuthUser()
    const token = await tokenFor(id, { expiresAt: Math.floor(Date.now() / 1000) - 60 })
    const res = await me(bearer(token))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      error: { code: 'unauthorized', message: 'Your sign-in has expired. Please sign in again.' },
    })
  })

  it('creates a respondent profile on the first call', async () => {
    const id = await addAuthUser()
    const token = await tokenFor(id, { email: 'juan@aclc.test', fullName: 'Juan Dela Cruz' })
    const res = await me(bearer(token))
    expect(res.status).toBe(200)
    expect(await profileOf(id)).toMatchObject({
      email: 'juan@aclc.test',
      fullName: 'Juan Dela Cruz',
      avatarUrl: 'https://lh3.googleusercontent.com/a/test',
      role: 'respondent',
    })
  })

  it('makes an ADMIN_EMAILS account an admin on its first call, ignoring case', async () => {
    const id = await addAuthUser()
    const token = await tokenFor(id, { email: ADMIN_EMAIL.toUpperCase() })
    const res = await me(bearer(token))
    expect(res.status).toBe(200)
    expect((await profileOf(id))?.role).toBe('admin')
  })

  it("doesn't make an unverified email an admin", async () => {
    const id = await addAuthUser()
    const token = await tokenFor(id, { email: ADMIN_EMAIL, emailVerified: false })
    await me(bearer(token))
    expect((await profileOf(id))?.role).toBe('respondent')
  })

  it('keeps the role of an existing profile, even for an ADMIN_EMAILS account', async () => {
    const id = await addAuthUser()
    await testDb.insert(profiles).values({ id, email: ADMIN_EMAIL, role: 'facilitator' })
    await me(bearer(await tokenFor(id, { email: ADMIN_EMAIL })))
    expect((await profileOf(id))?.role).toBe('facilitator')
  })

  it('creates one profile when the first calls arrive together', async () => {
    const id = await addAuthUser()
    const headers = bearer(await tokenFor(id))
    const [a, b] = await Promise.all([me(headers), me(headers)])
    expect([a.status, b.status]).toEqual([200, 200])
    expect(await testDb.select().from(profiles).where(eq(profiles.id, id))).toHaveLength(1)
  })

  it('refreshes name, photo and last sign-in on a new Google sign-in only', async () => {
    const id = await addAuthUser()
    const firstSignIn = Math.floor(Date.now() / 1000) - 3600
    await me(bearer(await tokenFor(id, { signedInAt: firstSignIn, fullName: 'Juan' })))

    // A refreshed token from the same sign-in changes nothing.
    await me(bearer(await tokenFor(id, { signedInAt: firstSignIn, fullName: 'Changed' })))
    expect(await profileOf(id)).toMatchObject({
      fullName: 'Juan',
      lastSignInAt: new Date(firstSignIn * 1000),
    })

    const nextSignIn = firstSignIn + 1800
    await me(bearer(await tokenFor(id, { signedInAt: nextSignIn, fullName: 'Juan D.' })))
    expect(await profileOf(id)).toMatchObject({
      fullName: 'Juan D.',
      lastSignInAt: new Date(nextSignIn * 1000),
    })
  })
})

describe('requireRole', () => {
  const staffRoute = createRoute({
    method: 'get',
    path: '/staff',
    middleware: [auth, requireRole('facilitator', 'admin')] as const,
    responses: { 200: { description: 'Staff only' } },
  })
  const adminRoute = createRoute({
    method: 'get',
    path: '/admin',
    middleware: [auth, requireRole('admin')] as const,
    responses: { 200: { description: 'Admin only' } },
  })
  const testApp = new OpenAPIHono<AppEnv>()
  testApp.use(dbMiddleware)
  testApp
    .openapi(staffRoute, (c) => c.text(c.var.profile.role, 200))
    .openapi(adminRoute, (c) => c.text(c.var.profile.role, 200))
  testApp.onError(handleError)

  const status = async (path: string, role: 'respondent' | 'facilitator' | 'admin') =>
    (await testApp.request(path, { headers: (await signedIn(role)).headers }, env)).status

  it('lets staff routes through for facilitators and admins only', async () => {
    expect(await status('/staff', 'respondent')).toBe(403)
    expect(await status('/staff', 'facilitator')).toBe(200)
    expect(await status('/staff', 'admin')).toBe(200)
  })

  it('lets admin routes through for admins only', async () => {
    expect(await status('/admin', 'respondent')).toBe(403)
    expect(await status('/admin', 'facilitator')).toBe(403)
    expect(await status('/admin', 'admin')).toBe(200)
  })

  it('sends forbidden in the error shape', async () => {
    const res = await testApp.request('/admin', { headers: (await signedIn()).headers }, env)
    expect(await res.json()).toEqual({
      error: { code: 'forbidden', message: "You don't have access to this." },
    })
  })
})

describe('GET /api/v1/me', () => {
  const addRespondent = async (profileId: string) => {
    const [row] = await testDb
      .insert(respondents)
      .values({
        profileId,
        fullName: 'Juan Dela Cruz',
        birthDate: '2007-06-15',
        sex: 'male',
        mode: 'online',
        consentVersion: '1',
        consentedAt: new Date(),
      })
      .returning()
    return row!
  }
  const addAttempt = async (respondentId: string, status: 'in_progress' | 'voided') => {
    const [row] = await testDb
      .insert(attempts)
      .values({
        respondentId,
        status,
        expiresAt: new Date(Date.now() + 25 * 60_000),
        questionOrder: [],
        choiceOrder: {},
      })
      .returning()
    return row!
  }

  it('answers with the profile and no respondent before consent', async () => {
    const user = await signedIn('facilitator')
    const res = await get('/api/v1/me', user.headers)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      profile: {
        id: user.id,
        email: user.email,
        fullName: null,
        avatarUrl: null,
        role: 'facilitator',
      },
      respondent: null,
      attempt: null,
    })
  })

  it('includes the respondent and their attempt', async () => {
    const user = await signedIn()
    const respondent = await addRespondent(user.id)
    const attempt = await addAttempt(respondent.id, 'in_progress')
    const body = await (await get('/api/v1/me', user.headers)).json()
    // toEqual, so school details sneaking back into the respondent fail the test (PRO-06).
    expect(body).toEqual({
      profile: expect.any(Object),
      respondent: { id: respondent.id, fullName: 'Juan Dela Cruz' },
      attempt: expect.objectContaining({ id: attempt.id, status: 'in_progress' }),
    })
  })

  it('leaves out a voided attempt', async () => {
    const user = await signedIn()
    const respondent = await addRespondent(user.id)
    await addAttempt(respondent.id, 'voided')
    const body = await (await get('/api/v1/me', user.headers)).json()
    expect(body).toMatchObject({ respondent: { id: respondent.id }, attempt: null })
  })
})

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

describe('API docs', () => {
  it('builds the OpenAPI spec with every route', async () => {
    const res = await get('/api/openapi.json')
    expect(res.status).toBe(200)
    const spec = (await res.json()) as { paths: Record<string, unknown> }
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining(['/api/v1/health', '/api/v1/me', '/api/v1/respondents']),
    )
  })
})

// Respondent rows inserted straight into the database, to test its checks.
const base = {
  fullName: 'Juan Dela Cruz',
  birthDate: '2007-06-15',
  sex: 'male',
  consentVersion: '1',
  consentedAt: new Date(),
} as const
const school = {
  studentNumber: STUDENT_NUMBER_EXAMPLE,
  course: COURSES[0],
  yearLevel: YEAR_LEVELS[0],
}

// The Postgres error sits under Drizzle's wrapper, as `cause`.
const insertError = async (values: typeof respondents.$inferInsert) => {
  try {
    await testDb.insert(respondents).values(values)
  } catch (error) {
    return (error as { cause?: { constraint?: string } }).cause?.constraint
  }
}

describe('respondents_school_fields_by_mode', () => {
  it('takes a kiosk row with school details and an online row without', async () => {
    const user = await signedIn()
    expect(await insertError({ ...base, ...school, mode: 'kiosk' })).toBeUndefined()
    expect(await insertError({ ...base, mode: 'online', profileId: user.id })).toBeUndefined()
  })

  it.each([
    ['without a student number', { ...school, studentNumber: null }],
    ['without a course', { ...school, course: null }],
    ['without a year level', { ...school, yearLevel: null }],
  ])('refuses a kiosk row %s', async (_, fields) => {
    expect(await insertError({ ...base, ...fields, mode: 'kiosk' })).toBe(
      'respondents_school_fields_by_mode',
    )
  })

  it('refuses a kiosk row linked to a profile', async () => {
    const user = await signedIn()
    expect(await insertError({ ...base, ...school, mode: 'kiosk', profileId: user.id })).toBe(
      'respondents_school_fields_by_mode',
    )
  })

  it.each([
    ['a student number', { studentNumber: school.studentNumber }],
    ['a course', { course: school.course }],
    ['a year level', { yearLevel: school.yearLevel }],
  ])('refuses an online row with %s', async (_, fields) => {
    const user = await signedIn()
    expect(await insertError({ ...base, ...fields, mode: 'online', profileId: user.id })).toBe(
      'respondents_school_fields_by_mode',
    )
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
