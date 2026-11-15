// Signing in: the auth middleware, requireRole and GET /me.
import { attempts, profiles, respondents } from '@digibridge/db'
import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { eq } from 'drizzle-orm'
import { generateKeyPair } from 'jose'
import { describe, expect, it } from 'vitest'
import type { AppEnv } from '../env'
import { auth, dbMiddleware, handleError, requireRole } from '../middleware'
import { ADMIN_EMAIL, addAuthUser, bearer, env, signedIn, testDb, tokenFor } from './helpers'
import { get, withStatus } from './fixtures'

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
        ...withStatus(status),
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
