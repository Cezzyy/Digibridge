import {
  answers,
  areaResults,
  attempts,
  choices,
  competencyAreas,
  lessons,
  profiles,
  questions,
  respondents,
  schoolLinks,
  susResponses,
} from '@digibridge/db'
import {
  AGE_MAX,
  AGE_MIN,
  ANSWER_GRACE_SECONDS,
  addDays,
  AREA_CODES,
  ATTEMPT_DURATION_MINUTES,
  CHOICES_PER_QUESTION,
  ITEMS_PER_ATTEMPT,
  LESSON_TIERS,
  LINK_CODE_ALPHABET,
  LINK_CODE_LENGTH,
  linkExpiresAt,
  lessonResourceSchema,
  lessonSlugSchema,
  MIN_SCENARIO_ITEMS_PER_AREA,
  toIsoDate,
  COURSES,
  LINK_GONE_MESSAGES,
  ONLINE_CONSENT_NOTICE,
  RESPONDENT_TOKEN_HEADER,
  RESPONDENT_TOKEN_REGEX,
  SCHOOL_CONSENT_NOTICE,
  STUDENT_NUMBER_EXAMPLE,
  todayInPhilippines,
  YEAR_LEVELS,
} from '@digibridge/shared'
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import { generateKeyPair } from 'jose'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExecutionContext, ScheduledController } from '@cloudflare/workers-types'
import { app } from './app'
import type { AppEnv } from './env'
import worker from './index'
import { hashRespondentToken } from './lib/respondent-token'
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
  addQuestionBank,
  bearer,
  clearAccounts,
  clearQuestionBank,
  env,
  serveTestJwks,
  setUpDatabase,
  signedIn,
  testDb,
  tokenFor,
  addSchoolLink,
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

  it('allows the respondent token header, for school-link students', async () => {
    const res = await preflight(WEB_ORIGIN)
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain(RESPONDENT_TOKEN_HEADER)
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

  it('leaves out the respondent of a user who became staff', async () => {
    const user = await signedIn('admin')
    const respondent = await addRespondent(user.id)
    await addAttempt(respondent.id, 'in_progress')
    const body = await (await get('/api/v1/me', user.headers)).json()
    expect(body).toMatchObject({ profile: { role: 'admin' }, respondent: null, attempt: null })
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

// ---- The assessment: start, read, answer, submit ----

const start = (headers: Record<string, string> = {}) =>
  app.request('/api/v1/attempts', { method: 'POST', headers }, env)

/** A respondent who has agreed to the notice and saved their profile. */
const respondent = async () => {
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
const attemptsOf = (respondentId: string) =>
  testDb.select().from(attempts).where(eq(attempts.respondentId, respondentId))

describe('POST /api/v1/attempts', () => {
  // Before each test: clearAccounts empties questions too (questions.created_by points at
  // profiles, so its cascade reaches them), but leaves the areas.
  let bank: Awaited<ReturnType<typeof addQuestionBank>>
  beforeEach(async () => {
    await clearQuestionBank()
    bank = await addQuestionBank()
  })
  afterAll(clearQuestionBank)

  it('starts an attempt with the 30 active items and their choices shuffled (ASM-01, ASM-02)', async () => {
    const user = await respondent()
    const before = Date.now()
    const res = await start(user.headers)
    expect(res.status).toBe(201)
    const body = (await res.json()) as Record<string, string>
    expect(body).toEqual({
      id: expect.any(String),
      status: 'in_progress',
      startedAt: expect.any(String),
      expiresAt: expect.any(String),
      serverTime: expect.any(String),
    })
    const duration = Date.parse(body.expiresAt!) - Date.parse(body.startedAt!)
    expect(duration).toBe(ATTEMPT_DURATION_MINUTES * 60_000)
    expect(Date.parse(body.serverTime!)).toBeGreaterThanOrEqual(before - 1000)

    const [row] = await attemptsOf(user.respondentId)
    expect(row!.id).toBe(body.id)
    // The bank holds exactly the 4/4/2 mix per area, so every active item is used, and no inactive one.
    expect(row!.questionOrder).toHaveLength(ITEMS_PER_ATTEMPT)
    expect(row!.questionOrder.toSorted()).toEqual(bank.active.toSorted())

    // Each item's own 4 choices, once each.
    const rows = await testDb
      .select({ id: choices.id, questionId: choices.questionId })
      .from(choices)
      .where(inArray(choices.questionId, row!.questionOrder))
    for (const questionId of row!.questionOrder) {
      const shown = row!.choiceOrder[questionId] ?? []
      expect(shown).toHaveLength(CHOICES_PER_QUESTION)
      const own = rows.filter((c) => c.questionId === questionId).map((c) => c.id)
      expect(shown.toSorted()).toEqual(own.toSorted())
    }

    // /me now knows the attempt.
    expect(await (await get('/api/v1/me', user.headers)).json()).toMatchObject({
      attempt: { id: body.id, status: 'in_progress' },
    })
  })

  it('returns the attempt in progress instead of starting another (ASM-07)', async () => {
    const user = await respondent()
    const first = (await (await start(user.headers)).json()) as Record<string, string>
    const res = await start(user.headers)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      id: first.id,
      startedAt: first.startedAt,
      expiresAt: first.expiresAt,
    })
    expect(await attemptsOf(user.respondentId)).toHaveLength(1)
  })

  it('starts one attempt when two arrive together', async () => {
    const user = await respondent()
    const results = await Promise.all([start(user.headers), start(user.headers)])
    expect(results.map((r) => r.status).sort()).toEqual([200, 201])
    const ids = await Promise.all(results.map(async (r) => ((await r.json()) as { id: string }).id))
    expect(ids[0]).toBe(ids[1])
    expect(await attemptsOf(user.respondentId)).toHaveLength(1)
  })

  it.each(['submitted', 'expired'] as const)(
    'refuses a second attempt after a %s one (PRO-07)',
    async (status) => {
      const user = await respondent()
      await start(user.headers)
      await testDb
        .update(attempts)
        .set({ status })
        .where(eq(attempts.respondentId, user.respondentId))
      const res = await start(user.headers)
      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({
        error: { code: 'conflict', message: 'You already took the assessment.' },
      })
      expect(await attemptsOf(user.respondentId)).toHaveLength(1)
    },
  )

  it('starts again after the attempt was voided', async () => {
    const user = await respondent()
    await start(user.headers)
    await testDb
      .update(attempts)
      .set({ status: 'voided', voidReason: 'Lost connection' })
      .where(eq(attempts.respondentId, user.respondentId))
    expect((await start(user.headers)).status).toBe(201)
    expect(await attemptsOf(user.respondentId)).toHaveLength(2)
  })

  it('sends conflict before the profile is saved', async () => {
    const user = await signedIn()
    const res = await start(user.headers)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: { code: 'conflict', message: 'Fill in your profile before you start.' },
    })
  })

  it.each(['facilitator', 'admin'] as const)('refuses %s accounts', async (role) => {
    const user = await signedIn(role)
    const res = await start(user.headers)
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: { code: 'forbidden' } })
  })

  it('sends unauthorized without a token', async () => {
    expect((await start()).status).toBe(401)
  })

  it('sends conflict and starts nothing when an area has too few active items', async () => {
    const user = await respondent()
    const [first] = bank.active
    await testDb.update(questions).set({ isActive: false }).where(eq(questions.id, first!))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const res = await start(user.headers)
      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({
        error: {
          code: 'conflict',
          message: 'The assessment isn’t ready yet. Please try again later.',
        },
      })
      expect(error).toHaveBeenCalled()
      expect(await attemptsOf(user.respondentId)).toHaveLength(0)
    } finally {
      error.mockRestore()
      await testDb.update(questions).set({ isActive: true }).where(eq(questions.id, first!))
    }
  })
})

describe('attempts in progress', () => {
  beforeEach(async () => {
    await clearQuestionBank()
    await addQuestionBank()
  })
  afterAll(clearQuestionBank)

  const json = { 'Content-Type': 'application/json' }
  const read = (id: string, headers: Record<string, string> = {}) =>
    get(`/api/v1/attempts/${id}`, headers)
  const save = (
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
  const submit = (id: string, headers: Record<string, string> = {}) =>
    app.request(`/api/v1/attempts/${id}/submit`, { method: 'POST', headers }, env)

  /** A respondent with a started attempt, and that attempt's row. */
  const started = async () => {
    const user = await respondent()
    await start(user.headers)
    const [attempt] = await attemptsOf(user.respondentId)
    return { user, attempt: attempt! }
  }
  const choicesOf = (questionId: string) =>
    testDb.select().from(choices).where(eq(choices.questionId, questionId))
  /** addQuestionBank makes position 0 the right choice. */
  const rightChoice = async (questionId: string) =>
    (await choicesOf(questionId)).find((c) => c.isCorrect)!.id
  const wrongChoice = async (questionId: string) =>
    (await choicesOf(questionId)).find((c) => !c.isCorrect)!.id
  const setExpiresAt = (attemptId: string, expiresAt: Date) =>
    testDb.update(attempts).set({ expiresAt }).where(eq(attempts.id, attemptId))

  describe('GET /api/v1/attempts/:id', () => {
    it('sends the items and choices in the attempt’s order, without the answers (ASM-02, RES-05)', async () => {
      const { user, attempt } = await started()
      const res = await read(attempt.id, user.headers)
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        items: { id: string; choices: { id: string }[] }[]
        answers: unknown[]
        serverTime: string
        expiresAt: string
      }
      expect(body.items.map((i) => i.id)).toEqual(attempt.questionOrder)
      for (const item of body.items) {
        expect(item.choices.map((c) => c.id)).toEqual(attempt.choiceOrder[item.id])
      }
      // toEqual: no isCorrect, explanation or difficulty sneaks in.
      expect(body.items[0]).toEqual({
        id: expect.any(String),
        area: expect.any(String),
        stem: expect.any(String),
        imageUrl: null,
        isScenario: false,
        choices: Array.from({ length: CHOICES_PER_QUESTION }, () => ({
          id: expect.any(String),
          label: expect.any(String),
        })),
      })
      expect(body.answers).toEqual([])
      expect(body.expiresAt).toBe(attempt.expiresAt.toISOString())
      expect(body.serverTime).toEqual(expect.any(String))
    })

    it('sends not_found for another respondent’s attempt or an unknown ID', async () => {
      const { attempt } = await started()
      const other = await respondent()
      for (const id of [attempt.id, crypto.randomUUID()]) {
        const res = await read(id, other.headers)
        expect(res.status).toBe(404)
        expect(await res.json()).toMatchObject({ error: { code: 'not_found' } })
      }
    })

    it('refuses staff and signed-out calls', async () => {
      const { attempt } = await started()
      expect((await read(attempt.id, (await signedIn('admin')).headers)).status).toBe(403)
      expect((await read(attempt.id)).status).toBe(401)
    })
  })

  describe('PUT /api/v1/attempts/:id/answers/:questionId', () => {
    it('saves an answer and replaces it when changed (ASM-04, ASM-05)', async () => {
      const { user, attempt } = await started()
      const questionId = attempt.questionOrder[0]!
      const [first, second] = attempt.choiceOrder[questionId]!

      const res = await save(attempt.id, questionId, first!, user.headers)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        questionId,
        choiceId: first,
        answeredAt: expect.any(String),
        serverTime: expect.any(String),
      })
      expect((await save(attempt.id, questionId, second!, user.headers)).status).toBe(200)

      const rows = await testDb.select().from(answers).where(eq(answers.attemptId, attempt.id))
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ questionId, choiceId: second, points: null })
      // A reload gets it back (ASM-07).
      expect(await (await read(attempt.id, user.headers)).json()).toMatchObject({
        answers: [{ questionId, choiceId: second }],
      })
    })

    it('refuses a question outside the attempt and a choice of another question', async () => {
      const { user, attempt } = await started()
      const [inAttempt, otherInAttempt] = attempt.questionOrder
      const [inactive] = await testDb.select().from(questions).where(eq(questions.isActive, false))
      const outside = await save(
        attempt.id,
        inactive!.id,
        await rightChoice(inactive!.id),
        user.headers,
      )
      expect(outside.status).toBe(400)
      expect(await outside.json()).toEqual({
        error: { code: 'bad_request', message: 'This question isn’t part of your assessment.' },
      })
      const foreign = await save(
        attempt.id,
        inAttempt!,
        attempt.choiceOrder[otherInAttempt!]![0]!,
        user.headers,
      )
      expect(foreign.status).toBe(400)
      expect(await testDb.select().from(answers)).toHaveLength(0)
    })

    it('takes answers up to 30 s past expires_at, then refuses them (ASM-09)', async () => {
      const { user, attempt } = await started()
      const questionId = attempt.questionOrder[0]!
      const choiceId = attempt.choiceOrder[questionId]![0]!

      await setExpiresAt(attempt.id, new Date(Date.now() - (ANSWER_GRACE_SECONDS - 10) * 1000))
      expect((await save(attempt.id, questionId, choiceId, user.headers)).status).toBe(200)

      await setExpiresAt(attempt.id, new Date(Date.now() - (ANSWER_GRACE_SECONDS + 1) * 1000))
      const res = await save(attempt.id, questionId, choiceId, user.headers)
      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({
        error: { code: 'conflict', message: 'Time is up, so this answer wasn’t saved.' },
      })
    })

    it('refuses answers once the attempt is submitted', async () => {
      const { user, attempt } = await started()
      await submit(attempt.id, user.headers)
      const questionId = attempt.questionOrder[0]!
      const res = await save(attempt.id, questionId, await rightChoice(questionId), user.headers)
      expect(res.status).toBe(409)
      expect(await testDb.select().from(answers)).toHaveLength(0)
    })

    it('sends not_found for another respondent’s attempt, and refuses staff', async () => {
      const { attempt } = await started()
      const questionId = attempt.questionOrder[0]!
      const choiceId = attempt.choiceOrder[questionId]![0]!
      const other = await respondent()
      expect((await save(attempt.id, questionId, choiceId, other.headers)).status).toBe(404)
      const staff = await signedIn('facilitator')
      expect((await save(attempt.id, questionId, choiceId, staff.headers)).status).toBe(403)
    })

    it('refuses a body without a valid choice ID', async () => {
      const { user, attempt } = await started()
      const res = await save(attempt.id, attempt.questionOrder[0]!, 'not-a-uuid', user.headers)
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ error: { code: 'validation_failed' } })
    })
  })

  describe('POST /api/v1/attempts/:id/submit', () => {
    it('scores the saved answers, writes the area results and closes the attempt', async () => {
      const { user, attempt } = await started()
      const items = await testDb
        .select({ id: questions.id, difficulty: questions.difficulty })
        .from(questions)
        .where(inArray(questions.id, attempt.questionOrder))
      // Right on every basic item (12 points), wrong on 1 advanced, the rest unanswered.
      const basics = items.filter((i) => i.difficulty === 'basic')
      for (const item of basics) {
        await save(attempt.id, item.id, await rightChoice(item.id), user.headers)
      }
      const advanced = items.find((i) => i.difficulty === 'advanced')!
      await save(attempt.id, advanced.id, await wrongChoice(advanced.id), user.headers)

      const res = await submit(attempt.id, user.headers)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        id: attempt.id,
        status: 'submitted',
        submittedAt: expect.any(String),
      })

      const [closed] = await attemptsOf(user.respondentId)
      // 12 of 54 is 22.22%: Beginner.
      expect(closed).toMatchObject({
        status: 'submitted',
        totalPoints: 12,
        overallPct: 22.22,
        overallLevel: 'beginner',
      })
      const results = await testDb
        .select()
        .from(areaResults)
        .where(eq(areaResults.attemptId, attempt.id))
      expect(results).toHaveLength(3)
      // 4 of 18 in each area is 22.22%.
      for (const r of results) {
        expect(r).toMatchObject({ points: 4, maxPoints: 18, pct: 22.22, level: 'beginner' })
      }
      const saved = await testDb.select().from(answers).where(eq(answers.attemptId, attempt.id))
      expect(saved.find((a) => a.questionId === advanced.id)?.points).toBe(0)
      expect(saved.filter((a) => a.points === 1)).toHaveLength(basics.length)

      // /me follows, and a new start is refused.
      expect(await (await get('/api/v1/me', user.headers)).json()).toMatchObject({
        attempt: { id: attempt.id, status: 'submitted' },
      })
      expect((await start(user.headers)).status).toBe(409)
    })

    it('is safe to call twice', async () => {
      const { user, attempt } = await started()
      const first = await (await submit(attempt.id, user.headers)).json()
      const again = await submit(attempt.id, user.headers)
      expect(again.status).toBe(200)
      expect(await again.json()).toEqual(first)
      const results = await testDb
        .select()
        .from(areaResults)
        .where(eq(areaResults.attemptId, attempt.id))
      expect(results).toHaveLength(3)
    })

    it('scores one attempt when two submits arrive together', async () => {
      const { user, attempt } = await started()
      const replies = await Promise.all([
        submit(attempt.id, user.headers),
        submit(attempt.id, user.headers),
      ])
      expect(replies.map((r) => r.status)).toEqual([200, 200])
      const results = await testDb
        .select()
        .from(areaResults)
        .where(eq(areaResults.attemptId, attempt.id))
      expect(results).toHaveLength(3)
    })

    it('closes a late attempt as expired, at expires_at', async () => {
      const { user, attempt } = await started()
      const expiresAt = new Date(Date.now() - (ANSWER_GRACE_SECONDS + 60) * 1000)
      await setExpiresAt(attempt.id, expiresAt)
      expect(await (await submit(attempt.id, user.headers)).json()).toEqual({
        id: attempt.id,
        status: 'expired',
        submittedAt: expiresAt.toISOString(),
      })
    })

    it('returns an attempt closed elsewhere without submitted_at, at expires_at', async () => {
      const { user, attempt } = await started()
      const expiresAt = new Date(Date.now() - (ANSWER_GRACE_SECONDS + 60) * 1000)
      await testDb
        .update(attempts)
        .set({ status: 'expired', expiresAt, submittedAt: null })
        .where(eq(attempts.id, attempt.id))
      const res = await submit(attempt.id, user.headers)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        id: attempt.id,
        status: 'expired',
        submittedAt: expiresAt.toISOString(),
      })
    })

    it('sends conflict for a voided attempt', async () => {
      const { user, attempt } = await started()
      await testDb
        .update(attempts)
        .set({ status: 'voided', voidReason: 'Test' })
        .where(eq(attempts.id, attempt.id))
      const res = await submit(attempt.id, user.headers)
      expect(res.status).toBe(409)
      expect(await testDb.select().from(areaResults)).toHaveLength(0)
    })

    it('sends not_found for another respondent’s attempt, and refuses staff', async () => {
      const { attempt } = await started()
      expect((await submit(attempt.id, (await respondent()).headers)).status).toBe(404)
      expect((await submit(attempt.id, (await signedIn('admin')).headers)).status).toBe(403)
      expect((await attemptsOf(attempt.respondentId))[0]?.status).toBe('in_progress')
    })
  })

  describe('cron (scheduled handler)', () => {
    /** Runs the Worker's scheduled handler as the cron trigger would, and waits for it. */
    const runCron = async () => {
      const pending: Promise<unknown>[] = []
      const ctx = { waitUntil: (p: Promise<unknown>) => pending.push(p) }
      worker.scheduled({} as ScheduledController, env, ctx as unknown as ExecutionContext)
      await Promise.all(pending)
    }
    const secondsAgo = (s: number) => new Date(Date.now() - s * 1000)

    it('closes attempts past expires_at plus the grace period as expired, with their scores', async () => {
      const late = await started()
      const basic = await testDb
        .select({ id: questions.id })
        .from(questions)
        .where(inArray(questions.id, late.attempt.questionOrder))
        .then((rows) => rows[0]!)
      await save(late.attempt.id, basic.id, await rightChoice(basic.id), late.user.headers)
      const expiresAt = secondsAgo(ANSWER_GRACE_SECONDS + 60)
      await setExpiresAt(late.attempt.id, expiresAt)
      // Still within the grace period, and not due yet.
      const inGrace = await started()
      await setExpiresAt(inGrace.attempt.id, secondsAgo(ANSWER_GRACE_SECONDS - 10))
      const running = await started()

      await runCron()

      const [closed] = await attemptsOf(late.user.respondentId)
      expect(closed).toMatchObject({ status: 'expired', submittedAt: expiresAt })
      expect(closed!.totalPoints).toBeGreaterThan(0)
      expect(
        await testDb.select().from(areaResults).where(eq(areaResults.attemptId, late.attempt.id)),
      ).toHaveLength(3)
      for (const other of [inGrace, running]) {
        expect((await attemptsOf(other.user.respondentId))[0]?.status).toBe('in_progress')
      }
      expect(await (await get('/api/v1/me', late.user.headers)).json()).toMatchObject({
        attempt: { id: late.attempt.id, status: 'expired' },
      })
    })

    it('leaves closed attempts alone, so running it again changes nothing', async () => {
      const { user, attempt } = await started()
      await submit(attempt.id, user.headers)
      await setExpiresAt(attempt.id, secondsAgo(ANSWER_GRACE_SECONDS + 60))
      await runCron()
      await runCron()
      expect((await attemptsOf(user.respondentId))[0]?.status).toBe('submitted')
      expect(
        await testDb.select().from(areaResults).where(eq(areaResults.attemptId, attempt.id)),
      ).toHaveLength(3)
    })
  })

  describe('GET /api/v1/attempts/:id/result', () => {
    const result = (id: string, headers: Record<string, string> = {}) =>
      get(`/api/v1/attempts/${id}/result`, headers)
    const areaId = async (code: string) =>
      (
        await testDb
          .select({ id: competencyAreas.id })
          .from(competencyAreas)
          .where(eq(competencyAreas.code, code))
      )[0]!.id

    it('sends the scores, levels and lessons for each area, and no marks per item (RES-01, RES-02, RES-05)', async () => {
      const { user, attempt } = await started()
      const items = await testDb
        .select({ id: questions.id, difficulty: questions.difficulty, area: competencyAreas.code })
        .from(questions)
        .innerJoin(competencyAreas, eq(competencyAreas.id, questions.areaId))
        .where(inArray(questions.id, attempt.questionOrder))
      // Information: all right, 18 of 18 (Advanced). Communication: the basic items and 2
      // intermediate ones, 8 of 18 (44.44%, Basic). Safety: the basic items, 4 of 18 (Beginner).
      const right = [
        ...items.filter((i) => i.area === 'info_literacy'),
        ...items.filter((i) => i.area === 'communication' && i.difficulty === 'basic'),
        ...items
          .filter((i) => i.area === 'communication' && i.difficulty === 'intermediate')
          .slice(0, 2),
        ...items.filter((i) => i.area === 'safety' && i.difficulty === 'basic'),
      ]
      for (const item of right) {
        await save(attempt.id, item.id, await rightChoice(item.id), user.headers)
      }
      await submit(attempt.id, user.headers)

      // Published: safety's Foundations and Intermediate lessons (2 rows for safety in the join;
      // Beginner shows only Foundations) and communication's Intermediate one. A draft of
      // communication's Foundations lesson doesn't count.
      const lesson = { slug: 'safety-foundations', title: 'Staying safe', summary: 'The basics' }
      const nextLesson = { slug: 'communication-intermediate', title: 'Talk', summary: 'More' }
      await testDb.insert(lessons).values([
        {
          ...lesson,
          areaId: await areaId('safety'),
          tier: 'foundations',
          bodyMd: '#',
          isPublished: true,
        },
        {
          slug: 'safety-intermediate',
          title: 'Safer',
          summary: 'Next',
          areaId: await areaId('safety'),
          tier: 'intermediate',
          bodyMd: '#',
          isPublished: true,
        },
        {
          ...nextLesson,
          areaId: await areaId('communication'),
          tier: 'intermediate',
          bodyMd: '#',
          isPublished: true,
        },
        {
          slug: 'communication-foundations',
          title: 'Draft',
          summary: 'Draft',
          areaId: await areaId('communication'),
          tier: 'foundations',
          bodyMd: '#',
        },
      ])

      const res = await result(attempt.id, user.headers)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toEqual({
        id: attempt.id,
        status: 'submitted',
        submittedAt: expect.any(String),
        // 30 of 54 is 55.56%.
        overall: { points: 30, maxPoints: 54, pct: 55.56, level: 'basic' },
        areas: [
          {
            area: 'info_literacy',
            points: 18,
            maxPoints: 18,
            pct: 100,
            level: 'advanced',
            lessons: [{ tier: 'advanced', nextStep: false, lesson: null }],
          },
          {
            area: 'communication',
            points: 8,
            maxPoints: 18,
            pct: 44.44,
            level: 'basic',
            lessons: [
              { tier: 'foundations', nextStep: false, lesson: null },
              { tier: 'intermediate', nextStep: true, lesson: nextLesson },
            ],
          },
          {
            area: 'safety',
            points: 4,
            maxPoints: 18,
            pct: 22.22,
            level: 'beginner',
            lessons: [{ tier: 'foundations', nextStep: false, lesson }],
          },
        ],
        resultsToken: null,
        susAnswered: false,
      })
      expect(JSON.stringify(body)).not.toMatch(/correct|question|choice/i)
    })

    it('works for an expired attempt and says whether the survey is answered', async () => {
      const { user, attempt } = await started()
      await setExpiresAt(attempt.id, new Date(Date.now() - (ANSWER_GRACE_SECONDS + 60) * 1000))
      await submit(attempt.id, user.headers)
      // All 3s, which scores 50.
      const q = { q1: 3, q2: 3, q3: 3, q4: 3, q5: 3, q6: 3, q7: 3, q8: 3, q9: 3, q10: 3 }
      await testDb.insert(susResponses).values({ attemptId: attempt.id, ...q, score: 50 })

      const res = await result(attempt.id, user.headers)
      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({
        status: 'expired',
        overall: { points: 0, pct: 0, level: 'beginner' },
        susAnswered: true,
      })
    })

    it('sends conflict before submit and for a voided attempt', async () => {
      const { user, attempt } = await started()
      expect((await result(attempt.id, user.headers)).status).toBe(409)
      await submit(attempt.id, user.headers)
      await testDb
        .update(attempts)
        .set({ status: 'voided', voidReason: 'Test' })
        .where(eq(attempts.id, attempt.id))
      expect((await result(attempt.id, user.headers)).status).toBe(409)
    })

    it('sends not_found for another respondent’s attempt, and refuses staff and signed-out calls', async () => {
      const { user, attempt } = await started()
      await submit(attempt.id, user.headers)
      expect((await result(attempt.id, (await respondent()).headers)).status).toBe(404)
      expect((await result(crypto.randomUUID(), user.headers)).status).toBe(404)
      expect((await result(attempt.id, (await signedIn('facilitator')).headers)).status).toBe(403)
      expect((await result(attempt.id)).status).toBe(401)
    })
  })

  describe('POST /api/v1/attempts/:id/sus', () => {
    const rate = (id: string, answers: unknown, headers: Record<string, string> = {}) =>
      app.request(
        `/api/v1/attempts/${id}/sus`,
        { method: 'POST', headers: { ...headers, ...json }, body: JSON.stringify({ answers }) },
        env,
      )
    const surveysOf = (attemptId: string) =>
      testDb.select().from(susResponses).where(eq(susResponses.attemptId, attemptId))
    /** A respondent whose attempt is submitted. */
    const finished = async () => {
      const { user, attempt } = await started()
      await submit(attempt.id, user.headers)
      return { user, attempt }
    }
    // Positive statements 4, 4, 5, 3, 4 and negative 2, 1, 2, 3, 2: 15 + 15 = 30, × 2.5 = 75.
    const answers = [4, 2, 4, 1, 5, 2, 3, 3, 4, 2]

    it('saves the 10 answers and the score worked out on the server (SUS-01, SUS-04)', async () => {
      const { user, attempt } = await finished()
      const res = await rate(attempt.id, answers, user.headers)
      expect(res.status).toBe(201)
      expect(await res.json()).toEqual({
        attemptId: attempt.id,
        score: 75,
        submittedAt: expect.any(String),
      })
      expect(await surveysOf(attempt.id)).toEqual([
        {
          attemptId: attempt.id,
          q1: 4,
          q2: 2,
          q3: 4,
          q4: 1,
          q5: 5,
          q6: 2,
          q7: 3,
          q8: 3,
          q9: 4,
          q10: 2,
          score: 75,
          submittedAt: expect.any(Date),
        },
      ])
      const res2 = await get(`/api/v1/attempts/${attempt.id}/result`, user.headers)
      expect(await res2.json()).toMatchObject({ susAnswered: true })
    })

    it('works for an expired attempt', async () => {
      const { user, attempt } = await started()
      await setExpiresAt(attempt.id, new Date(Date.now() - (ANSWER_GRACE_SECONDS + 60) * 1000))
      await submit(attempt.id, user.headers)
      const res = await rate(attempt.id, Array(10).fill(3), user.headers)
      expect(res.status).toBe(201)
      expect(await res.json()).toMatchObject({ score: 50 })
    })

    it('sends already_answered for a second survey and keeps the first, even when both arrive together', async () => {
      const { user, attempt } = await finished()
      const replies = await Promise.all([
        rate(attempt.id, answers, user.headers),
        rate(attempt.id, Array(10).fill(3), user.headers),
      ])
      expect(replies.map((r) => r.status).toSorted()).toEqual([201, 409])
      expect(await surveysOf(attempt.id)).toHaveLength(1)

      const again = await rate(attempt.id, answers, user.headers)
      expect(again.status).toBe(409)
      expect(await again.json()).toEqual({
        error: { code: 'already_answered', message: 'You already rated DigiBridge. Thank you!' },
      })
    })

    it.each([
      ['9 answers', [3, 3, 3, 3, 3, 3, 3, 3, 3], 'Answer all 10 statements.'],
      ['11 answers', Array(11).fill(3), 'Answer all 10 statements.'],
      ['a 0', [0, 3, 3, 3, 3, 3, 3, 3, 3, 3], 'Pick an answer from 1 to 5 for each statement.'],
      ['a 6', [3, 3, 3, 3, 3, 3, 3, 3, 3, 6], 'Pick an answer from 1 to 5 for each statement.'],
      [
        'a fraction',
        [3, 3, 2.5, 3, 3, 3, 3, 3, 3, 3],
        'Pick an answer from 1 to 5 for each statement.',
      ],
      [
        'a missing answer',
        [3, 3, null, 3, 3, 3, 3, 3, 3, 3],
        'Pick an answer from 1 to 5 for each statement.',
      ],
      ['no list', undefined, 'Answer all 10 statements.'],
    ])('refuses %s and saves nothing', async (_, given, message) => {
      const { user, attempt } = await finished()
      const res = await rate(attempt.id, given, user.headers)
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: { code: 'validation_failed', message } })
      expect(await surveysOf(attempt.id)).toHaveLength(0)
    })

    it('sends conflict while the attempt is in progress and once it is voided', async () => {
      const { user, attempt } = await started()
      expect((await rate(attempt.id, answers, user.headers)).status).toBe(409)
      await submit(attempt.id, user.headers)
      await testDb
        .update(attempts)
        .set({ status: 'voided', voidReason: 'Test' })
        .where(eq(attempts.id, attempt.id))
      const res = await rate(attempt.id, answers, user.headers)
      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({
        error: { code: 'conflict', message: 'This assessment was cancelled by the team.' },
      })
      expect(await surveysOf(attempt.id)).toHaveLength(0)
    })

    it('sends not_found for another respondent’s attempt, and refuses staff and signed-out calls', async () => {
      const { user, attempt } = await finished()
      expect((await rate(attempt.id, answers, (await respondent()).headers)).status).toBe(404)
      expect((await rate(crypto.randomUUID(), answers, user.headers)).status).toBe(404)
      expect((await rate(attempt.id, answers, (await signedIn('admin')).headers)).status).toBe(403)
      expect((await rate(attempt.id, answers)).status).toBe(401)
      expect(await surveysOf(attempt.id)).toHaveLength(0)
    })
  })
})

describe('school links', () => {
  beforeEach(async () => {
    await clearQuestionBank()
    await addQuestionBank()
  })
  afterAll(clearQuestionBank)

  const json = { 'Content-Type': 'application/json' }
  const openLink = (code: string, headers: Record<string, string> = {}) =>
    get(`/api/v1/links/${code}`, headers)
  const join = (code: string, body: unknown) =>
    app.request(
      `/api/v1/links/${code}/respondents`,
      { method: 'POST', headers: json, body: JSON.stringify(body) },
      env,
    )
  let number = 3000
  const profileFor = (fields: Record<string, unknown> = {}) => ({
    fullName: ' Ana  Cruz ',
    birthDate: '2007-06-15',
    sex: 'female',
    devices: ['smartphone'],
    internetAccess: ['mobile_data'],
    studentNumber: `c23-01-${++number}-man121`,
    course: 'BSIT',
    yearLevel: 2,
    showIdentity: true,
    consentVersion: SCHOOL_CONSENT_NOTICE.version,
    ...fields,
  })
  const tokenHeader = (token: string) => ({ [RESPONDENT_TOKEN_HEADER]: token })
  /** A token that looks right but was never given out. */
  const strangerToken = () => 'A'.repeat(43)

  type Joined = { respondent: { id: string; fullName: string }; token: string }
  /** A student who joined the link, with the header their browser sends from then on. */
  const joined = async (link: { code: string }, fields: Record<string, unknown> = {}) => {
    const res = await join(link.code, profileFor(fields))
    expect(res.status).toBe(201)
    const body = (await res.json()) as Joined
    return { respondentId: body.respondent.id, headers: tokenHeader(body.token) }
  }
  const linkRespondents = (linkId: string) =>
    testDb.select().from(respondents).where(eq(respondents.schoolLinkId, linkId))
  const closeIt = (linkId: string) =>
    testDb.update(schoolLinks).set({ closedAt: new Date() }).where(eq(schoolLinks.id, linkId))

  describe('GET /api/v1/links/:code', () => {
    it('gives an open link its name and lock, typed in any case (LNK-02)', async () => {
      const link = await addSchoolLink({ course: 'BSIT', yearLevel: 2, label: 'BSIT 2A' })
      const res = await openLink(link.code.toLowerCase())
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        code: link.code,
        school: 'ACLC College of Mandaue',
        label: 'BSIT 2A',
        course: 'BSIT',
        yearLevel: 2,
        respondent: null,
        attempt: null,
      })
    })

    it('answers 404 for an unknown code', async () => {
      const res = await openLink('NOSUCHCODE')
      expect(res.status).toBe(404)
      expect(await res.json()).toMatchObject({ error: { code: 'not_found' } })
    })

    it.each([
      ['closed', { closedAt: new Date() }],
      ['expired', { expiresAt: new Date(Date.now() - 1000) }],
      ['full', { maxResponses: 1 }],
    ] as const)('turns new students away from a %s link with 410', async (status, values) => {
      const link = await addSchoolLink(values)
      if (status === 'full') await joined(link)
      const res = await openLink(link.code)
      expect(res.status).toBe(410)
      expect(await res.json()).toEqual({
        error: { code: 'gone', message: LINK_GONE_MESSAGES[status] },
      })
    })

    it('lets a student who joined back in after the link closed, with their attempt (LNK-04)', async () => {
      const link = await addSchoolLink({ maxResponses: 1 })
      const student = await joined(link)
      const started = (await (await start(student.headers)).json()) as { id: string }
      await closeIt(link.id)

      const res = await openLink(link.code, student.headers)
      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({
        respondent: { id: student.respondentId, fullName: 'Ana Cruz' },
        attempt: { id: started.id, status: 'in_progress' },
      })
    })

    it('answers 401 for a token that isn’t one for this link', async () => {
      const a = await addSchoolLink()
      const b = await addSchoolLink()
      const student = await joined(a)
      for (const [code, headers] of [
        [b.code, student.headers],
        [a.code, tokenHeader(strangerToken())],
        [a.code, tokenHeader('not a token')],
      ] as const) {
        const res = await openLink(code, headers)
        expect(res.status).toBe(401)
        expect(await res.json()).toMatchObject({ error: { code: 'unauthorized' } })
      }
    })
  })

  describe('POST /api/v1/links/:code/respondents', () => {
    it('saves the school profile and gives a token once, keeping only its hash (LNK-03)', async () => {
      const link = await addSchoolLink()
      const before = Date.now()
      const res = await join(
        link.code.toLowerCase(),
        profileFor({ studentNumber: 'c23-01-7557-man121' }),
      )
      expect(res.status).toBe(201)
      const body = (await res.json()) as Joined
      expect(body.respondent).toEqual({ id: expect.any(String), fullName: 'Ana Cruz' })
      expect(body.token).toMatch(RESPONDENT_TOKEN_REGEX)

      const [row] = await linkRespondents(link.id)
      expect(row).toMatchObject({
        id: body.respondent.id,
        mode: 'school',
        profileId: null,
        studentNumber: 'C23-01-7557-MAN121',
        course: 'BSIT',
        yearLevel: 2,
        showIdentity: true,
        consentVersion: SCHOOL_CONSENT_NOTICE.version,
        accessTokenHash: await hashRespondentToken(body.token),
      })
      expect(row!.accessTokenHash).not.toContain(body.token)
      expect(row!.consentedAt.getTime()).toBeGreaterThanOrEqual(before - 1000)
    })

    it('refuses a student number already used through any link (PRO-03)', async () => {
      const a = await addSchoolLink()
      const b = await addSchoolLink()
      await joined(a, { studentNumber: 'C23-01-7557-MAN121' })
      const res = await join(b.code, profileFor({ studentNumber: 'c23-01-7557-man121' }))
      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({
        error: {
          code: 'conflict',
          message:
            'This student number has already been used. If this is you, ask the DigiBridge team for help.',
        },
      })
      expect(await linkRespondents(b.id)).toHaveLength(0)
    })

    it('refuses a course or year level the link isn’t for', async () => {
      const link = await addSchoolLink({ course: 'BSCS', yearLevel: 1 })
      const res = await join(link.code, profileFor())
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({
        error: { code: 'validation_failed', message: 'This link is only for BSCS students.' },
      })
      expect((await join(link.code, profileFor({ course: 'BSCS', yearLevel: 1 }))).status).toBe(201)
    })

    it('refuses the online notice and a profile without the school details', async () => {
      const link = await addSchoolLink()
      const noNumber = profileFor()
      delete (noNumber as Record<string, unknown>).studentNumber
      for (const body of [
        profileFor({ consentVersion: ONLINE_CONSENT_NOTICE.version }),
        noNumber,
      ]) {
        expect((await join(link.code, body)).status).toBe(400)
      }
      expect(await linkRespondents(link.id)).toHaveLength(0)
    })

    it.each([
      ['closed', { closedAt: new Date() }],
      ['expired', { expiresAt: new Date(Date.now() - 1000) }],
    ] as const)('saves nothing through a %s link', async (status, values) => {
      const link = await addSchoolLink(values)
      const res = await join(link.code, profileFor())
      expect(res.status).toBe(410)
      expect(await res.json()).toEqual({
        error: { code: 'gone', message: LINK_GONE_MESSAGES[status] },
      })
      expect(await linkRespondents(link.id)).toHaveLength(0)
    })

    it('lets in only as many students as the limit, even all at once', async () => {
      const link = await addSchoolLink({ maxResponses: 2 })
      const results = await Promise.all(
        Array.from({ length: 4 }, () => join(link.code, profileFor())),
      )
      expect(results.map((r) => r.status).sort()).toEqual([201, 201, 410, 410])
      expect(await linkRespondents(link.id)).toHaveLength(2)
    })

    it('answers 404 for an unknown code', async () => {
      expect((await join('NOSUCHCODE', profileFor())).status).toBe(404)
    })
  })

  describe('the respondent token on the attempt routes', () => {
    it('takes a school-link student from start to results and the survey (LNK-04, LNK-05)', async () => {
      const link = await addSchoolLink()
      const student = await joined(link)
      const res = await start(student.headers)
      expect(res.status).toBe(201)
      const { id } = (await res.json()) as { id: string }
      const [attempt] = await attemptsOf(student.respondentId)
      expect(attempt).toMatchObject({ id, schoolLinkId: link.id })

      expect((await get(`/api/v1/attempts/${id}`, student.headers)).status).toBe(200)
      const questionId = attempt!.questionOrder[0]!
      const choiceId = attempt!.choiceOrder[questionId]![0]!
      const saved = await app.request(
        `/api/v1/attempts/${id}/answers/${questionId}`,
        {
          method: 'PUT',
          headers: { ...student.headers, ...json },
          body: JSON.stringify({ choiceId }),
        },
        env,
      )
      expect(saved.status).toBe(200)
      const submitted = await app.request(
        `/api/v1/attempts/${id}/submit`,
        { method: 'POST', headers: student.headers },
        env,
      )
      expect(submitted.status).toBe(200)
      expect((await get(`/api/v1/attempts/${id}/result`, student.headers)).status).toBe(200)
      const rated = await app.request(
        `/api/v1/attempts/${id}/sus`,
        {
          method: 'POST',
          headers: { ...student.headers, ...json },
          body: JSON.stringify({ answers: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3] }),
        },
        env,
      )
      expect(rated.status).toBe(201)

      // Opening the link again shows the finished attempt.
      expect(await (await openLink(link.code, student.headers)).json()).toMatchObject({
        attempt: { id, status: 'submitted' },
      })
    })

    it('lets a student who joined start after the link closed', async () => {
      const link = await addSchoolLink()
      const student = await joined(link)
      await closeIt(link.id)
      expect((await start(student.headers)).status).toBe(201)
    })

    it('answers 401 at start for a token that matches no one', async () => {
      for (const token of [strangerToken(), 'short']) {
        const res = await start(tokenHeader(token))
        expect(res.status).toBe(401)
        expect(await res.json()).toMatchObject({ error: { code: 'unauthorized' } })
      }
    })

    it('hides another student’s attempt behind 404', async () => {
      const link = await addSchoolLink()
      const owner = await joined(link)
      const { id } = (await (await start(owner.headers)).json()) as { id: string }
      const other = await joined(link)
      const online = await respondent()
      for (const headers of [other.headers, online.headers, tokenHeader(strangerToken())]) {
        expect((await get(`/api/v1/attempts/${id}`, headers)).status).toBe(404)
      }
    })

    it('goes by the token when a Google sign-in comes with it', async () => {
      const link = await addSchoolLink()
      const student = await joined(link)
      const admin = await signedIn('admin')
      const res = await start({ ...admin.headers, ...student.headers })
      expect(res.status).toBe(201)
      expect(await attemptsOf(student.respondentId)).toHaveLength(1)
    })
  })
})

describe('dev question bank (packages/db/seed/dev-questions.sql)', () => {
  const SEED = fileURLToPath(
    new URL('../../../packages/db/seed/dev-questions.sql', import.meta.url).href,
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

describe('lessons', () => {
  const areaId = async (code: string) =>
    (
      await testDb
        .select({ id: competencyAreas.id })
        .from(competencyAreas)
        .where(eq(competencyAreas.code, code))
    )[0]!.id

  // One lesson row with every field set; `overrides` picks its area, tier and the rest.
  const lessonRow = async (
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

  beforeEach(async () => {
    await clearQuestionBank()
    await addQuestionBank()
  })
  afterAll(clearQuestionBank)

  describe('GET /api/v1/lessons', () => {
    beforeEach(async () => {
      // Inserted out of order, to check the sorting. One draft, which stays hidden.
      await testDb.insert(lessons).values([
        await lessonRow('safety-advanced', 'safety', 'advanced'),
        await lessonRow('info-intermediate', 'info_literacy', 'intermediate'),
        await lessonRow('safety-foundations', 'safety', 'foundations'),
        await lessonRow('info-foundations', 'info_literacy', 'foundations'),
        await lessonRow('communication-draft', 'communication', 'foundations', {
          isPublished: false,
        }),
      ])
    })

    it('lists the published lessons by area, then tier, without signing in (LES-01, LES-03)', async () => {
      const res = await get('/api/v1/lessons')
      expect(res.status).toBe(200)
      const { lessons: list } = (await res.json()) as { lessons: Record<string, unknown>[] }
      expect(list.map((l) => l.slug)).toEqual([
        'info-foundations',
        'info-intermediate',
        'safety-foundations',
        'safety-advanced',
      ])
      expect(list[0]).toEqual({
        slug: 'info-foundations',
        area: 'info_literacy',
        tier: 'foundations',
        title: 'Title of info-foundations',
        summary: 'Summary of info-foundations',
      })
    })

    it('filters by area and tier', async () => {
      const slugs = async (query: string) => {
        const res = await get(`/api/v1/lessons?${query}`)
        expect(res.status).toBe(200)
        return ((await res.json()) as { lessons: { slug: string }[] }).lessons.map((l) => l.slug)
      }
      expect(await slugs('area=safety')).toEqual(['safety-foundations', 'safety-advanced'])
      expect(await slugs('tier=foundations')).toEqual(['info-foundations', 'safety-foundations'])
      expect(await slugs('area=info_literacy&tier=advanced')).toEqual([])
    })

    it('answers 400 for an unknown area or tier', async () => {
      for (const query of ['area=math', 'tier=expert']) {
        const res = await get(`/api/v1/lessons?${query}`)
        expect(res.status).toBe(400)
      }
    })
  })

  describe('GET /api/v1/lessons/:slug', () => {
    it('sends the whole lesson without signing in (LES-02, LES-03)', async () => {
      const resources = [{ label: 'National Privacy Commission', url: 'https://privacy.gov.ph' }]
      await testDb.insert(lessons).values(
        await lessonRow('protect-your-data', 'safety', 'advanced', {
          bodyMd: '## Your rights\n\nYou can ask to see your data.',
          imageUrl: '/api/v1/media/lesson.png',
          videoUrl: 'https://www.youtube.com/watch?v=abc',
          resources,
        }),
      )
      const res = await get('/api/v1/lessons/protect-your-data')
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        slug: 'protect-your-data',
        area: 'safety',
        tier: 'advanced',
        title: 'Title of protect-your-data',
        summary: 'Summary of protect-your-data',
        bodyMd: '## Your rights\n\nYou can ask to see your data.',
        imageUrl: '/api/v1/media/lesson.png',
        videoUrl: 'https://www.youtube.com/watch?v=abc',
        resources,
        updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      })
    })

    it('answers 404 for a draft or a slug that doesn’t exist', async () => {
      await testDb
        .insert(lessons)
        .values(await lessonRow('draft', 'safety', 'foundations', { isPublished: false }))
      for (const slug of ['draft', 'nope']) {
        const res = await get(`/api/v1/lessons/${slug}`)
        expect(res.status).toBe(404)
        expect(await res.json()).toEqual({
          error: { code: 'not_found', message: expect.any(String) },
        })
      }
    })

    it('answers 400 for something that isn’t a slug', async () => {
      const res = await get('/api/v1/lessons/Not%20A%20Slug')
      expect(res.status).toBe(400)
    })
  })
  describe('admin lessons editor (CMS-04)', () => {
    const send = (method: string, path: string, headers: Record<string, string>, body?: unknown) =>
      app.request(
        path,
        {
          method,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
        env,
      )

    const input = {
      area: 'safety',
      tier: 'foundations',
      slug: 'spot-scams',
      title: ' Spot scams ',
      summary: 'Tell a scam from a real message.',
      bodyMd: '## What you’ll learn\n\n- One thing',
      imageUrl: 'https://example.com/scam.png',
      videoUrl: null,
      resources: [{ label: 'NPC', url: 'https://privacy.gov.ph' }],
      isPublished: false,
    }

    const insertLesson = async (...args: Parameters<typeof lessonRow>) => {
      const [row] = await testDb
        .insert(lessons)
        .values(await lessonRow(...args))
        .returning({ id: lessons.id })
      return row!.id
    }

    const published = async () =>
      (
        await testDb
          .select({ slug: lessons.slug })
          .from(lessons)
          .where(eq(lessons.isPublished, true))
          .orderBy(lessons.slug)
      ).map((l) => l.slug)

    describe('GET /api/v1/admin/lessons', () => {
      it('lists every lesson, drafts too, with the published one first in each tier', async () => {
        await insertLesson('safety-draft', 'safety', 'foundations', { isPublished: false })
        await insertLesson('safety-live', 'safety', 'foundations')
        await insertLesson('info-draft', 'info_literacy', 'advanced', { isPublished: false })

        const admin = await signedIn('admin')
        const res = await get('/api/v1/admin/lessons', admin.headers)
        expect(res.status).toBe(200)
        const { lessons: list } = (await res.json()) as { lessons: Record<string, unknown>[] }
        expect(list.map((l) => l.slug)).toEqual(['info-draft', 'safety-live', 'safety-draft'])
        expect(list[0]).toEqual({
          id: expect.any(String),
          slug: 'info-draft',
          area: 'info_literacy',
          tier: 'advanced',
          title: 'Title of info-draft',
          summary: 'Summary of info-draft',
          isPublished: false,
          updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        })
      })

      it('refuses facilitators', async () => {
        const staff = await signedIn('facilitator')
        expect((await get('/api/v1/admin/lessons', staff.headers)).status).toBe(403)
      })
    })

    describe('GET /api/v1/admin/lessons/:id', () => {
      it('sends a whole draft', async () => {
        const id = await insertLesson('a-draft', 'communication', 'intermediate', {
          isPublished: false,
          videoUrl: 'https://www.youtube.com/watch?v=abc',
        })
        const admin = await signedIn('admin')
        const res = await get(`/api/v1/admin/lessons/${id}`, admin.headers)
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
          id,
          slug: 'a-draft',
          area: 'communication',
          tier: 'intermediate',
          title: 'Title of a-draft',
          summary: 'Summary of a-draft',
          bodyMd: '## a-draft',
          imageUrl: null,
          videoUrl: 'https://www.youtube.com/watch?v=abc',
          resources: [],
          isPublished: false,
          updatedAt: expect.any(String),
        })
      })

      it('answers 404 for a lesson that isn’t there', async () => {
        const admin = await signedIn('admin')
        const res = await get(`/api/v1/admin/lessons/${crypto.randomUUID()}`, admin.headers)
        expect(res.status).toBe(404)
      })
    })

    describe('POST /api/v1/admin/lessons', () => {
      it('adds a draft and sends it back with nothing extra', async () => {
        const admin = await signedIn('admin')
        const res = await send('POST', '/api/v1/admin/lessons', admin.headers, input)
        expect(res.status).toBe(201)
        expect(await res.json()).toEqual({
          ...input,
          title: 'Spot scams',
          id: expect.any(String),
          updatedAt: expect.any(String),
        })
        expect(await published()).toEqual([])
      })

      it('publishing takes the place of the lesson published for that area and tier', async () => {
        await insertLesson('old-scams', 'safety', 'foundations')
        await insertLesson('other-tier', 'safety', 'intermediate')
        const admin = await signedIn('admin')
        const res = await send('POST', '/api/v1/admin/lessons', admin.headers, {
          ...input,
          isPublished: true,
        })
        expect(res.status).toBe(201)
        expect(await published()).toEqual(['other-tier', 'spot-scams'])
      })

      it('answers 409 for a slug in use and 400 for a bad field', async () => {
        await insertLesson('spot-scams', 'info_literacy', 'advanced', { isPublished: false })
        const admin = await signedIn('admin')
        const taken = await send('POST', '/api/v1/admin/lessons', admin.headers, input)
        expect(taken.status).toBe(409)
        expect(await taken.json()).toEqual({
          error: { code: 'conflict', message: expect.stringContaining('slug') },
        })
        for (const bad of [{ slug: 'Not A Slug' }, { title: ' ' }, { videoUrl: 'ftp://a.ph' }]) {
          const res = await send('POST', '/api/v1/admin/lessons', admin.headers, {
            ...input,
            slug: 'fresh',
            ...bad,
          })
          expect(res.status).toBe(400)
        }
      })

      it('refuses facilitators', async () => {
        const staff = await signedIn('facilitator')
        const res = await send('POST', '/api/v1/admin/lessons', staff.headers, input)
        expect(res.status).toBe(403)
        expect(await testDb.select().from(lessons)).toEqual([])
      })
    })

    describe('PATCH /api/v1/admin/lessons/:id', () => {
      it('changes only the fields sent', async () => {
        const id = await insertLesson('a-draft', 'safety', 'foundations', { isPublished: false })
        const admin = await signedIn('admin')
        const res = await send('PATCH', `/api/v1/admin/lessons/${id}`, admin.headers, {
          title: 'New title',
          resources: input.resources,
        })
        expect(res.status).toBe(200)
        expect(await res.json()).toMatchObject({
          id,
          slug: 'a-draft',
          area: 'safety',
          title: 'New title',
          summary: 'Summary of a-draft',
          resources: input.resources,
          isPublished: false,
        })
      })

      it('publishing a draft unpublishes the lesson it replaces', async () => {
        await insertLesson('old', 'safety', 'foundations')
        const id = await insertLesson('new', 'safety', 'foundations', { isPublished: false })
        const admin = await signedIn('admin')
        const res = await send('PATCH', `/api/v1/admin/lessons/${id}`, admin.headers, {
          isPublished: true,
        })
        expect(res.status).toBe(200)
        expect(await published()).toEqual(['new'])
      })

      it('a published lesson moved to another area and tier takes that one’s place', async () => {
        await insertLesson('info-live', 'info_literacy', 'advanced')
        const id = await insertLesson('moving', 'safety', 'foundations')
        const admin = await signedIn('admin')
        const res = await send('PATCH', `/api/v1/admin/lessons/${id}`, admin.headers, {
          area: 'info_literacy',
          tier: 'advanced',
        })
        expect(res.status).toBe(200)
        expect(await res.json()).toMatchObject({ area: 'info_literacy', tier: 'advanced' })
        expect(await published()).toEqual(['moving'])
      })

      it('unpublishing leaves the area and tier empty', async () => {
        const id = await insertLesson('live', 'safety', 'foundations')
        const admin = await signedIn('admin')
        const res = await send('PATCH', `/api/v1/admin/lessons/${id}`, admin.headers, {
          isPublished: false,
        })
        expect(res.status).toBe(200)
        expect(await published()).toEqual([])
      })

      it('answers 409 for a slug in use and 404 for a lesson that isn’t there', async () => {
        await insertLesson('taken', 'safety', 'advanced')
        const id = await insertLesson('mine', 'safety', 'foundations')
        const admin = await signedIn('admin')
        const taken = await send('PATCH', `/api/v1/admin/lessons/${id}`, admin.headers, {
          slug: 'taken',
        })
        expect(taken.status).toBe(409)
        const missing = await send(
          'PATCH',
          `/api/v1/admin/lessons/${crypto.randomUUID()}`,
          admin.headers,
          { title: 'x' },
        )
        expect(missing.status).toBe(404)
      })

      it('refuses facilitators', async () => {
        const id = await insertLesson('mine', 'safety', 'foundations')
        const staff = await signedIn('facilitator')
        const res = await send('PATCH', `/api/v1/admin/lessons/${id}`, staff.headers, {
          isPublished: false,
        })
        expect(res.status).toBe(403)
        expect(await published()).toEqual(['mine'])
      })
    })

    describe('DELETE /api/v1/admin/lessons/:id', () => {
      it('deletes a draft', async () => {
        const id = await insertLesson('a-draft', 'safety', 'foundations', { isPublished: false })
        const admin = await signedIn('admin')
        const res = await send('DELETE', `/api/v1/admin/lessons/${id}`, admin.headers)
        expect(res.status).toBe(204)
        expect(await testDb.select().from(lessons)).toEqual([])
      })

      it('keeps a published lesson (409) and answers 404 for one that isn’t there', async () => {
        const id = await insertLesson('live', 'safety', 'foundations')
        const admin = await signedIn('admin')
        const live = await send('DELETE', `/api/v1/admin/lessons/${id}`, admin.headers)
        expect(live.status).toBe(409)
        expect(await published()).toEqual(['live'])
        const missing = await send(
          'DELETE',
          `/api/v1/admin/lessons/${crypto.randomUUID()}`,
          admin.headers,
        )
        expect(missing.status).toBe(404)
      })

      it('refuses facilitators', async () => {
        const id = await insertLesson('a-draft', 'safety', 'foundations', { isPublished: false })
        const staff = await signedIn('facilitator')
        expect((await send('DELETE', `/api/v1/admin/lessons/${id}`, staff.headers)).status).toBe(
          403,
        )
      })
    })
  })
})

describe('starter lessons (packages/db/seed/lessons.sql)', () => {
  const seed = (name: string) =>
    fileURLToPath(new URL(`../../../packages/db/seed/${name}`, import.meta.url).href)
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

describe('API docs', () => {
  it('builds the OpenAPI spec with every route', async () => {
    const res = await get('/api/openapi.json')
    expect(res.status).toBe(200)
    const spec = (await res.json()) as { paths: Record<string, unknown> }
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining([
        '/api/v1/health',
        '/api/v1/me',
        '/api/v1/respondents',
        '/api/v1/attempts',
        '/api/v1/attempts/{id}',
        '/api/v1/attempts/{id}/answers/{questionId}',
        '/api/v1/attempts/{id}/submit',
        '/api/v1/attempts/{id}/result',
        '/api/v1/attempts/{id}/sus',
        '/api/v1/lessons',
        '/api/v1/lessons/{slug}',
        '/api/v1/admin/overview',
        '/api/v1/admin/links',
        '/api/v1/admin/links/{id}/close',
      ]),
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
  accessTokenHash: 'a'.repeat(64),
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

describe('admin', () => {
  const send = (method: string, path: string, headers: Record<string, string>, body?: unknown) =>
    app.request(
      path,
      {
        method,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      env,
    )

  const addLink = addSchoolLink

  // A respondent with one attempt, online (with an account) or through a school link.
  let studentCount = 0
  const addStudent = async (
    status: 'in_progress' | 'submitted' | 'expired' | 'voided',
    schoolLinkId?: string,
  ) => {
    const values = schoolLinkId
      ? {
          ...base,
          ...school,
          studentNumber: `C23-01-${String(1000 + ++studentCount)}-MAN121`,
          accessTokenHash: crypto.randomUUID(),
          schoolLinkId,
          mode: 'school' as const,
        }
      : { ...base, mode: 'online' as const, profileId: (await signedIn()).id }
    const [row] = await testDb.insert(respondents).values(values).returning()
    await testDb.insert(attempts).values({
      respondentId: row!.id,
      schoolLinkId,
      status,
      expiresAt: new Date(Date.now() + 25 * 60_000),
      questionOrder: [],
      choiceOrder: {},
    })
  }

  describe('GET /api/v1/admin/overview', () => {
    it('counts respondents, attempts and open links for staff', async () => {
      const link = await addLink()
      await addLink({ closedAt: new Date() })
      await addStudent('in_progress')
      await addStudent('submitted', link.id)
      await addStudent('expired', link.id)
      await addStudent('voided', link.id)

      const staff = await signedIn('facilitator')
      const res = await get('/api/v1/admin/overview', staff.headers)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        respondents: { total: 4, online: 1, school: 3 },
        attempts: { inProgress: 1, finished: 2 },
        links: { open: 1, total: 2 },
      })
    })

    it('refuses respondents', async () => {
      const user = await signedIn()
      expect((await get('/api/v1/admin/overview', user.headers)).status).toBe(403)
    })
  })

  describe('POST /api/v1/admin/links', () => {
    const expiresOn = addDays(todayInPhilippines(), 7)
    const link = { school: ' ACLC College of Mandaue ', label: 'BSIT 2A', expiresOn }

    it('makes a link with a random code that closes after its last day (LNK-01)', async () => {
      const admin = await signedIn('admin')
      const res = await send('POST', '/api/v1/admin/links', admin.headers, {
        ...link,
        course: 'BSIT',
        yearLevel: 2,
        maxResponses: 40,
      })
      expect(res.status).toBe(201)
      const body = (await res.json()) as Record<string, unknown>
      expect(body).toEqual({
        id: expect.any(String),
        code: expect.any(String),
        school: 'ACLC College of Mandaue',
        label: 'BSIT 2A',
        course: 'BSIT',
        yearLevel: 2,
        maxResponses: 40,
        expiresAt: linkExpiresAt(expiresOn).toISOString(),
        closedAt: null,
        createdAt: expect.any(String),
        createdBy: admin.email,
        responses: 0,
        status: 'open',
      })
      expect(body.code).toMatch(new RegExp(`^[${LINK_CODE_ALPHABET}]{${LINK_CODE_LENGTH}}$`))

      const [row] = await testDb.select().from(schoolLinks)
      expect(row).toMatchObject({ id: body.id, createdBy: admin.id })
    })

    it('leaves the course, year level and limit open when not sent', async () => {
      const admin = await signedIn('admin')
      const res = await send('POST', '/api/v1/admin/links', admin.headers, link)
      expect(res.status).toBe(201)
      expect(await res.json()).toMatchObject({ course: null, yearLevel: null, maxResponses: null })
    })

    it('refuses a year level the course doesn’t have, and a past day', async () => {
      const admin = await signedIn('admin')
      for (const bad of [
        { ...link, course: 'HRT', yearLevel: 4 },
        { ...link, expiresOn: addDays(todayInPhilippines(), -1) },
      ]) {
        const res = await send('POST', '/api/v1/admin/links', admin.headers, bad)
        expect(res.status).toBe(400)
      }
      expect(await testDb.select().from(schoolLinks)).toEqual([])
    })

    it('refuses facilitators', async () => {
      const staff = await signedIn('facilitator')
      expect((await send('POST', '/api/v1/admin/links', staff.headers, link)).status).toBe(403)
    })
  })

  describe('GET /api/v1/admin/links', () => {
    it('lists links newest first with their status and responses', async () => {
      const day = 86_400_000
      const full = await addLink({
        label: 'full',
        maxResponses: 1,
        createdAt: new Date(Date.now() - 4 * day),
      })
      await addLink({
        label: 'expired',
        expiresAt: new Date(Date.now() - 1000),
        createdAt: new Date(Date.now() - 3 * day),
      })
      await addLink({
        label: 'closed',
        closedAt: new Date(),
        createdAt: new Date(Date.now() - 2 * day),
      })
      const open = await addLink({ label: 'open', maxResponses: 3 })
      await addStudent('submitted', full.id)
      await addStudent('in_progress', open.id)
      // A student counts from the profile on, so a voided attempt still does.
      await addStudent('voided', open.id)

      const admin = await signedIn('admin')
      const res = await get('/api/v1/admin/links', admin.headers)
      expect(res.status).toBe(200)
      const body = (await res.json()) as { label: string; status: string; responses: number }[]
      expect(body.map(({ label, status, responses }) => ({ label, status, responses }))).toEqual([
        { label: 'open', status: 'open', responses: 2 },
        { label: 'closed', status: 'closed', responses: 0 },
        { label: 'expired', status: 'expired', responses: 0 },
        { label: 'full', status: 'full', responses: 1 },
      ])
    })

    it('refuses facilitators', async () => {
      const staff = await signedIn('facilitator')
      expect((await get('/api/v1/admin/links', staff.headers)).status).toBe(403)
    })
  })

  describe('POST /api/v1/admin/links/:id/close', () => {
    it('closes a link once, keeping the first closing time', async () => {
      const link = await addLink()
      const admin = await signedIn('admin')
      const path = `/api/v1/admin/links/${link.id}/close`

      const first = await send('POST', path, admin.headers)
      expect(first.status).toBe(200)
      const closed = (await first.json()) as { status: string; closedAt: string }
      expect(closed).toMatchObject({ status: 'closed', closedAt: expect.any(String) })

      const again = (await (await send('POST', path, admin.headers)).json()) as typeof closed
      expect(again.closedAt).toBe(closed.closedAt)
    })

    it('leaves an expired link expired', async () => {
      const link = await addLink({ expiresAt: new Date(Date.now() - 60_000) })
      const admin = await signedIn('admin')
      const res = await send('POST', `/api/v1/admin/links/${link.id}/close`, admin.headers)
      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ status: 'expired', closedAt: null })
    })

    it('answers 404 for an unknown link and 403 for facilitators', async () => {
      const admin = await signedIn('admin')
      const unknown = `/api/v1/admin/links/${crypto.randomUUID()}/close`
      expect((await send('POST', unknown, admin.headers)).status).toBe(404)

      const link = await addLink()
      const staff = await signedIn('facilitator')
      expect(
        (await send('POST', `/api/v1/admin/links/${link.id}/close`, staff.headers)).status,
      ).toBe(403)
    })
  })
})

describe('admin respondents', () => {
  beforeEach(async () => {
    await clearQuestionBank()
    await addQuestionBank()
  })
  afterAll(clearQuestionBank)

  type Listed = {
    respondents: Record<string, unknown>[]
    total: number
    page: number
    pageSize: number
  }
  const list = async (query: string, headers: Record<string, string>) => {
    const res = await get(`/api/v1/admin/respondents${query}`, headers)
    return { status: res.status, body: (await res.json()) as Listed }
  }

  const linkFor = (label: string) => addSchoolLink({ label })

  /**
   * A school respondent, straight into the database, with an attempt in the given state. They
   * joined through the attempt's link, or else a link of their own.
   */
  let studentNumber = 2000
  const addSchoolRespondent = async (
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
          status: attempt.status,
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

  describe('GET /api/v1/admin/respondents', () => {
    it('lists respondents newest first, with hidden identities left out (DSH-05, PRO-05)', async () => {
      const link = await linkFor('BSIT 2A')
      const hidden = await addSchoolRespondent(
        { fullName: 'Maria Santos', consentedAt: new Date('2026-11-10T02:00:00Z') },
        { status: 'submitted', linkId: link.id, pct: 55.5 },
      )
      // Joined through the link but not started yet: the link shows all the same.
      const shown = await addSchoolRespondent({
        fullName: 'Pedro Reyes',
        showIdentity: true,
        consentedAt: new Date('2026-11-11T02:00:00Z'),
        schoolLinkId: link.id,
      })

      const staff = await signedIn('facilitator')
      const { status, body } = await list('', staff.headers)
      expect(status).toBe(200)
      expect(body).toMatchObject({ total: 2, page: 1, pageSize: 20 })
      expect(body.respondents.map((r) => r.id)).toEqual([shown.id, hidden.id])
      expect(body.respondents[0]).toMatchObject({
        fullName: 'Pedro Reyes',
        studentNumber: shown.studentNumber,
        identityHidden: false,
        status: 'not_started',
        schoolLink: { id: link.id, label: 'BSIT 2A' },
        attemptId: null,
      })
      expect(body.respondents[1]).toMatchObject({
        mode: 'school',
        fullName: null,
        studentNumber: null,
        identityHidden: true,
        course: school.course,
        yearLevel: school.yearLevel,
        // Born 2007-06-15, consented 2026-11-10.
        age: 19,
        ageGroup: '18_20',
        status: 'finished',
        schoolLink: { id: link.id, label: 'BSIT 2A' },
        overallPct: 55.5,
        overallLevel: 'basic',
      })
      expect(JSON.stringify(body)).not.toContain('Maria Santos')
    })

    it('shows online respondents with empty school cells', async () => {
      await respondent()
      const admin = await signedIn('admin')
      const { body } = await list('', admin.headers)
      expect(body.respondents[0]).toMatchObject({
        mode: 'online',
        studentNumber: null,
        course: null,
        yearLevel: null,
        schoolLink: null,
      })
    })

    it('filters by status, mode, link, course, age group and consent date', async () => {
      const a = await linkFor('BSIT 2A')
      const b = await linkFor('BSCS 1A')
      const finishedA = await addSchoolRespondent({}, { status: 'expired', linkId: a.id, pct: 40 })
      const startedB = await addSchoolRespondent(
        { course: 'BSCS', consentedAt: new Date('2026-11-01T02:00:00Z') },
        { status: 'in_progress', linkId: b.id },
      )
      const voided = await addSchoolRespondent({}, { status: 'voided', linkId: a.id })
      const online = await respondent()

      const admin = await signedIn('admin')
      const ids = async (query: string) =>
        (await list(query, admin.headers)).body.respondents.map((r) => r.id).sort()

      expect(await ids('?status=finished')).toEqual([finishedA.id])
      expect(await ids('?status=in_progress')).toEqual([startedB.id])
      expect(await ids('?status=voided')).toEqual([voided.id])
      expect(await ids('?status=not_started')).toEqual([online.respondentId])
      expect(await ids('?mode=online')).toEqual([online.respondentId])
      expect(await ids(`?schoolLinkId=${a.id}`)).toEqual([finishedA.id, voided.id].sort())
      expect(await ids('?course=BSCS')).toEqual([startedB.id])
      expect(await ids('?ageGroup=21_23')).toEqual([])
      expect(await ids('?from=2026-11-01&to=2026-11-01')).toEqual([startedB.id])
    })

    it('finds shown names and student numbers only, and sorts hidden names last', async () => {
      const shown = await addSchoolRespondent({ fullName: 'Ana Cruz', showIdentity: true })
      const hidden = await addSchoolRespondent({ fullName: 'Aaron Cruz' })
      const admin = await signedIn('admin')

      const found = await list('?q=cruz', admin.headers)
      expect(found.body.respondents.map((r) => r.id)).toEqual([shown.id])
      const byNumber = await list(`?q=${hidden.studentNumber}`, admin.headers)
      expect(byNumber.body.total).toBe(0)

      const sorted = await list('?sort=name', admin.headers)
      expect(sorted.body.respondents.map((r) => r.id)).toEqual([shown.id, hidden.id])
    })

    it('sorts by score and pages', async () => {
      const link = await linkFor('BSIT 2A')
      const low = await addSchoolRespondent({}, { status: 'submitted', linkId: link.id, pct: 30 })
      const high = await addSchoolRespondent({}, { status: 'submitted', linkId: link.id, pct: 90 })
      const none = await addSchoolRespondent({})
      const admin = await signedIn('admin')

      const best = await list('?sort=score_high', admin.headers)
      expect(best.body.respondents.map((r) => r.id)).toEqual([high.id, low.id, none.id])
      const worst = await list('?sort=score_low', admin.headers)
      expect(worst.body.respondents.map((r) => r.id)).toEqual([low.id, high.id, none.id])

      const second = await list('?page=2', admin.headers)
      expect(second.body).toMatchObject({ respondents: [], total: 3, page: 2 })
    })

    it('leaves out a voided score, in the row and the sort', async () => {
      const link = await linkFor('BSIT 2A')
      const scored = await addSchoolRespondent(
        {},
        { status: 'submitted', linkId: link.id, pct: 50 },
      )
      const voided = await addSchoolRespondent({}, { status: 'voided', linkId: link.id, pct: 95 })
      const admin = await signedIn('admin')

      const best = await list('?sort=score_high', admin.headers)
      expect(best.body.respondents.map((r) => r.id)).toEqual([scored.id, voided.id])
      expect(best.body.respondents[0]).toMatchObject({ overallPct: 50, overallLevel: 'basic' })
      expect(best.body.respondents[1]).toMatchObject({
        status: 'voided',
        overallPct: null,
        overallLevel: null,
      })
    })

    it('refuses respondents and bad filters', async () => {
      const user = await signedIn()
      expect((await list('', user.headers)).status).toBe(403)
      const admin = await signedIn('admin')
      expect((await list('?sex=other', admin.headers)).status).toBe(400)
      expect((await list('?page=0', admin.headers)).status).toBe(400)
    })
  })

  describe('GET /api/v1/admin/respondents/:id', () => {
    /** An online respondent who answered 2 items (1 right, 1 wrong), then submitted. */
    const finished = async () => {
      const user = await respondent()
      await start(user.headers)
      const [attempt] = await attemptsOf(user.respondentId)
      const [first, second] = attempt!.questionOrder
      const choicesOf = (id: string) =>
        testDb.select().from(choices).where(eq(choices.questionId, id))
      const right = (await choicesOf(first!)).find((c) => c.isCorrect)!
      const wrong = (await choicesOf(second!)).find((c) => !c.isCorrect)!
      const json = { ...user.headers, 'Content-Type': 'application/json' }
      for (const [questionId, choiceId] of [
        [first!, right.id],
        [second!, wrong.id],
      ] as const) {
        await app.request(
          `/api/v1/attempts/${attempt!.id}/answers/${questionId}`,
          { method: 'PUT', headers: json, body: JSON.stringify({ choiceId }) },
          env,
        )
      }
      await app.request(
        `/api/v1/attempts/${attempt!.id}/submit`,
        { method: 'POST', headers: user.headers },
        env,
      )
      return { user, attempt: attempt!, right, wrong }
    }

    type Detail = {
      respondent: Record<string, unknown>
      attempt: {
        status: string
        timeTakenSeconds: number | null
        areas: unknown[]
        sus: unknown
        answers:
          | {
              questionId: string
              choices: { id: string }[]
              pickedChoiceId: string | null
              correct: boolean
              points: number | null
            }[]
          | null
      } | null
    }
    const detail = async (id: string, headers: Record<string, string>) => {
      const res = await get(`/api/v1/admin/respondents/${id}`, headers)
      return { status: res.status, body: (await res.json()) as Detail }
    }

    it('gives admins the answer sheet in the order shown (DSH-05)', async () => {
      const { user, attempt, right, wrong } = await finished()
      const admin = await signedIn('admin')
      const { status, body } = await detail(user.respondentId, admin.headers)
      expect(status).toBe(200)
      expect(body.respondent).toMatchObject({ id: user.respondentId, status: 'finished' })
      expect(body.attempt).toMatchObject({
        status: 'submitted',
        timeTakenSeconds: expect.any(Number),
        sus: null,
      })
      expect(body.attempt!.areas).toHaveLength(AREA_CODES.length)

      const sheet = body.attempt!.answers!
      expect(sheet.map((item) => item.questionId)).toEqual(attempt.questionOrder)
      expect(sheet[0]!.choices.map((c) => c.id)).toEqual(
        attempt.choiceOrder[attempt.questionOrder[0]!],
      )
      expect(sheet[0]).toMatchObject({ pickedChoiceId: right.id, correct: true })
      expect(sheet[1]).toMatchObject({ pickedChoiceId: wrong.id, correct: false, points: 0 })
      expect(sheet[2]).toMatchObject({ pickedChoiceId: null, correct: false, points: null })
    })

    it('leaves the answer sheet out for facilitators (DSH-07)', async () => {
      const { user } = await finished()
      const staff = await signedIn('facilitator')
      const { status, body } = await detail(user.respondentId, staff.headers)
      expect(status).toBe(200)
      expect(body.attempt!.areas).toHaveLength(AREA_CODES.length)
      expect(body.attempt!.answers).toBeNull()
    })

    it('includes the SUS answers once given', async () => {
      const { user, attempt } = await finished()
      await app.request(
        `/api/v1/attempts/${attempt.id}/sus`,
        {
          method: 'POST',
          headers: { ...user.headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: [5, 1, 5, 1, 5, 1, 5, 1, 5, 1] }),
        },
        env,
      )
      const admin = await signedIn('admin')
      const { body } = await detail(user.respondentId, admin.headers)
      expect(body.attempt!.sus).toEqual({ score: 100, answers: [5, 1, 5, 1, 5, 1, 5, 1, 5, 1] })
    })

    it('has no attempt before they start, and hides a hidden name', async () => {
      const row = await addSchoolRespondent({ fullName: 'Maria Santos' })
      const admin = await signedIn('admin')
      const { body } = await detail(row.id, admin.headers)
      expect(body).toMatchObject({
        respondent: { fullName: null, studentNumber: null, identityHidden: true },
        attempt: null,
      })
    })

    it('answers 404 for an unknown respondent and 403 for respondents', async () => {
      const admin = await signedIn('admin')
      expect((await detail(crypto.randomUUID(), admin.headers)).status).toBe(404)
      const { user } = await finished()
      expect((await detail(user.respondentId, user.headers)).status).toBe(403)
    })
  })
  describe('GET /api/v1/admin/stats', () => {
    type Stats = {
      respondents: number
      finished: number
      completionRate: number | null
      averageOverallPct: number | null
      medianTimeSeconds: number | null
      overallLevels: Record<string, number>
      areas: { area: string; averagePct: number | null; levels: Record<string, number> }[]
      sus: { responses: number; mean: number | null; statementMeans: (number | null)[] }
      comparison: { groupBy: string; groups: { key: string; label: string; finished: number }[] }
    }
    const stats = async (query: string, headers: Record<string, string>) => {
      const res = await get(`/api/v1/admin/stats${query}`, headers)
      return { status: res.status, body: (await res.json()) as Stats }
    }

    /** Area results at `pct` in every area, for an attempt. */
    const addAreaResults = async (attemptId: string, pct: number) => {
      const areas = await testDb.select().from(competencyAreas)
      await testDb.insert(areaResults).values(
        areas.map((area) => ({
          attemptId,
          areaId: area.id,
          points: 9,
          maxPoints: 18,
          pct,
          level: 'basic' as const,
        })),
      )
    }

    it('sums up finished attempts only, with SUS and a comparison (DSH-01 to DSH-04, SUS-05)', async () => {
      const link = await linkFor('BSIT 2A')
      const done = await addSchoolRespondent({}, { status: 'submitted', linkId: link.id, pct: 50 })
      await addAreaResults(done.attemptId!, 50)
      await testDb.insert(susResponses).values({
        attemptId: done.attemptId!,
        ...{ q1: 5, q2: 1, q3: 5, q4: 1, q5: 5, q6: 1, q7: 5, q8: 1, q9: 5, q10: 1 },
        score: 100,
      })
      await addSchoolRespondent({}, { status: 'in_progress', linkId: link.id })
      await addSchoolRespondent({}, { status: 'voided', linkId: link.id })
      await respondent()

      const staff = await signedIn('facilitator')
      const { status, body } = await stats('', staff.headers)
      expect(status).toBe(200)
      expect(body).toMatchObject({
        respondents: 4,
        finished: 1,
        completionRate: 25,
        averageOverallPct: 50,
        medianTimeSeconds: expect.any(Number),
        overallLevels: { beginner: 0, basic: 1, intermediate: 0, advanced: 0 },
        sus: { responses: 1, mean: 100 },
        comparison: {
          groupBy: 'mode',
          groups: [{ key: 'school', label: 'School link', finished: 1 }],
        },
      })
      expect(body.areas.map((area) => area.area)).toEqual(AREA_CODES)
      expect(body.areas[0]).toMatchObject({ averagePct: 50, levels: { basic: 1 } })
      expect(body.sus.statementMeans).toEqual([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])
    })

    it('follows the filters and groups by school link', async () => {
      const a = await linkFor('BSIT 2A')
      const b = await linkFor('BSCS 1A')
      await addSchoolRespondent({}, { status: 'submitted', linkId: a.id, pct: 80 })
      await addSchoolRespondent({ course: 'BSCS' }, { status: 'expired', linkId: b.id, pct: 20 })
      await respondent()
      const admin = await signedIn('admin')

      const byLink = await stats('?groupBy=school_link', admin.headers)
      expect(byLink.body.comparison.groups.map((g) => g.label)).toEqual(['BSCS 1A', 'BSIT 2A'])

      const bscs = await stats('?course=BSCS', admin.headers)
      expect(bscs.body).toMatchObject({ respondents: 1, finished: 1, averageOverallPct: 20 })
      const online = await stats('?mode=online', admin.headers)
      expect(online.body).toMatchObject({ respondents: 1, finished: 0, averageOverallPct: null })
    })

    it('refuses respondents and an unknown grouping', async () => {
      const user = await signedIn()
      expect((await stats('', user.headers)).status).toBe(403)
      const admin = await signedIn('admin')
      expect((await stats('?groupBy=name', admin.headers)).status).toBe(400)
    })
  })
  describe('GET /api/v1/admin/items', () => {
    type Item = {
      questionId: string
      isActive: boolean
      seen: number
      correct: number
      correctPct: number | null
      blank: number
      choices: { id: string; isCorrect: boolean; picked: number }[]
      flags: string[]
    }
    const items = async (query: string, headers: Record<string, string>) => {
      const res = await get(`/api/v1/admin/items${query}`, headers)
      return { status: res.status, body: (await res.json()) as { items: Item[] } }
    }

    /** An online respondent who picks `picks` (question → choice), then submits unless told not to. */
    const takes = async (picks: [string, string][], submit = true) => {
      const user = await respondent()
      await start(user.headers)
      const [attempt] = await attemptsOf(user.respondentId)
      for (const [questionId, choiceId] of picks) {
        await app.request(
          `/api/v1/attempts/${attempt!.id}/answers/${questionId}`,
          {
            method: 'PUT',
            headers: { ...user.headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ choiceId }),
          },
          env,
        )
      }
      if (submit) {
        await app.request(
          `/api/v1/attempts/${attempt!.id}/submit`,
          { method: 'POST', headers: user.headers },
          env,
        )
      }
    }

    it('counts finished attempts per item and choice, and flags them (DSH-08)', async () => {
      const [easy, hard] = await testDb
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.isActive, true))
        .limit(2)
      const choicesOf = (id: string) =>
        testDb.select().from(choices).where(eq(choices.questionId, id))
      const easyRight = (await choicesOf(easy!.id)).find((c) => c.isCorrect)!
      const hardWrong = (await choicesOf(hard!.id)).find((c) => !c.isCorrect)!

      // 5 finish: all right on `easy`, all the same wrong choice on `hard`.
      for (let i = 0; i < 5; i++) {
        await takes([
          [easy!.id, easyRight.id],
          [hard!.id, hardWrong.id],
        ])
      }
      // Still in progress: doesn't count.
      await takes([[hard!.id, hardWrong.id]], false)

      const admin = await signedIn('admin')
      const { status, body } = await items('', admin.headers)
      expect(status).toBe(200)
      const byId = new Map(body.items.map((item) => [item.questionId, item]))

      expect(byId.get(easy!.id)).toMatchObject({
        seen: 5,
        correct: 5,
        correctPct: 100,
        blank: 0,
        flags: ['too_easy'],
      })
      const hardStats = byId.get(hard!.id)!
      expect(hardStats).toMatchObject({
        seen: 5,
        correct: 0,
        correctPct: 0,
        flags: ['too_hard', 'confusing'],
      })
      expect(hardStats.choices.find((c) => c.id === hardWrong.id)?.picked).toBe(5)
      expect(hardStats.choices).toHaveLength(CHOICES_PER_QUESTION)

      // Every other active item was shown and left blank; inactive ones were never shown.
      const other = body.items.find(
        (item) => item.isActive && item.questionId !== easy!.id && item.questionId !== hard!.id,
      )
      expect(other).toMatchObject({ seen: 5, correct: 0, blank: 5, flags: ['too_hard'] })
      const inactive = body.items.find((item) => !item.isActive)
      expect(inactive).toMatchObject({ seen: 0, correctPct: null, flags: [] })

      // Filters apply: no school respondents finished.
      const school = await items('?mode=school', admin.headers)
      expect(school.body.items.every((item) => item.seen === 0)).toBe(true)
    })

    it('is for admins only', async () => {
      const staff = await signedIn('facilitator')
      expect((await items('', staff.headers)).status).toBe(403)
    })
  })
})
