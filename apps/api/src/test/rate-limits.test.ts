// Rate limits (middleware/rate-limit.ts): each limited route counts the right key against the right
// limiter, and a request over a limit gets 429 with Retry-After and changes nothing.
import { answers, attempts, respondents } from '@digibridge/db'
import { RESPONDENT_TOKEN_HEADER, SCHOOL_CONSENT_NOTICE } from '@digibridge/shared'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { app } from '../app'
import type { Bindings, RateLimiterName } from '../env'
import { sha256Hex } from '../lib/hash'
import { addSchoolLink, env, testDb, testLimiter } from './helpers'
import { attemptsOf, json, respondent, started, useQuestionBank } from './fixtures'

useQuestionBank()

const IP = { 'CF-Connecting-IP': '203.0.113.7' }

/** The test env with one limiter swapped for one that counts keys, refusing all if `refuse`. */
const withLimiter = (name: RateLimiterName, refuse = false) => {
  const limiter = testLimiter(() => refuse)
  return { limiter, env: { ...env, [name]: limiter } as Bindings }
}

const request = (
  bindings: Bindings,
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: unknown,
) =>
  app.request(
    path,
    {
      method,
      headers: { ...headers, ...json },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    bindings,
  )

async function expectRateLimited(res: Response) {
  expect(res.status).toBe(429)
  expect(res.headers.get('Retry-After')).toBe('60')
  expect(await res.json()).toEqual({
    error: { code: 'rate_limited', message: expect.any(String) },
  })
}

const joinBody = (studentNumber: string) => ({
  fullName: 'Ana Cruz',
  birthDate: '2007-06-15',
  sex: 'female',
  devices: ['smartphone'],
  internetAccess: ['mobile_data'],
  studentNumber,
  course: 'BSIT',
  yearLevel: 2,
  showIdentity: true,
  consentVersion: SCHOOL_CONSENT_NOTICE.version,
})

describe('every /api/v1 route', () => {
  it('counts each request against the per-IP catch-all', async () => {
    const { limiter, env } = withLimiter('API_IP_LIMIT')
    await request(env, 'GET', '/api/v1/health', IP)
    await request(env, 'GET', '/api/v1/lessons')
    expect(limiter.keys).toEqual(['203.0.113.7', 'unknown'])
  })

  it('refuses a request over the catch-all with 429 and Retry-After', async () => {
    const { env } = withLimiter('API_IP_LIMIT', true)
    await expectRateLimited(await request(env, 'GET', '/api/v1/health', IP))
  })

  it('leaves the spec and docs out of the catch-all', async () => {
    const { limiter, env } = withLimiter('API_IP_LIMIT', true)
    expect((await request(env, 'GET', '/api/openapi.json')).status).toBe(200)
    expect(limiter.keys).toEqual([])
  })
})

describe('school links', () => {
  it('limits opening a link per IP', async () => {
    const link = await addSchoolLink()
    const counting = withLimiter('LINK_OPEN_LIMIT')
    expect((await request(counting.env, 'GET', `/api/v1/links/${link.code}`, IP)).status).toBe(200)
    expect(counting.limiter.keys).toEqual(['203.0.113.7'])

    const refusing = withLimiter('LINK_OPEN_LIMIT', true)
    await expectRateLimited(await request(refusing.env, 'GET', `/api/v1/links/${link.code}`, IP))
  })

  it('limits joining per IP and saves no one when refused', async () => {
    const link = await addSchoolLink()
    const { limiter, env } = withLimiter('LINK_JOIN_LIMIT', true)
    const res = await request(
      env,
      'POST',
      `/api/v1/links/${link.code}/respondents`,
      IP,
      joinBody('C23-01-4001-MAN121'),
    )
    await expectRateLimited(res)
    expect(limiter.keys).toEqual(['203.0.113.7'])
    expect(
      await testDb.select().from(respondents).where(eq(respondents.schoolLinkId, link.id)),
    ).toEqual([])
  })

  it('limits joining per student number, hashed and in any letter case', async () => {
    const link = await addSchoolLink()
    const { limiter, env } = withLimiter('STUDENT_NUMBER_LIMIT')
    const path = `/api/v1/links/${link.code}/respondents`
    expect((await request(env, 'POST', path, IP, joinBody(' c23-01-4002-man121 '))).status).toBe(
      201,
    )
    expect(limiter.keys).toEqual([await sha256Hex('C23-01-4002-MAN121')])
  })

  it('refuses a join over the student number limit, saving no one', async () => {
    const link = await addSchoolLink()
    const { env } = withLimiter('STUDENT_NUMBER_LIMIT', true)
    const res = await request(
      env,
      'POST',
      `/api/v1/links/${link.code}/respondents`,
      IP,
      joinBody('C23-01-4003-MAN121'),
    )
    await expectRateLimited(res)
    expect(
      await testDb.select().from(respondents).where(eq(respondents.schoolLinkId, link.id)),
    ).toEqual([])
  })

  it('doesn’t count a join without a valid student number, which fails its checks', async () => {
    const link = await addSchoolLink()
    const { limiter, env } = withLimiter('STUDENT_NUMBER_LIMIT', true)
    const path = `/api/v1/links/${link.code}/respondents`
    expect((await request(env, 'POST', path, IP, joinBody('not a number'))).status).toBe(400)
    expect((await request(env, 'POST', path, IP, { fullName: 'Ana Cruz' })).status).toBe(400)
    expect(limiter.keys).toEqual([])
  })
})

describe('answer saves', () => {
  const saveFirst = async (bindings: Bindings, headers: Record<string, string>) => {
    const { attempt } = await startedFor(headers)
    const questionId = attempt.questionOrder[0]!
    const res = await request(
      bindings,
      'PUT',
      `/api/v1/attempts/${attempt.id}/answers/${questionId}`,
      { ...IP, ...headers },
      { choiceId: crypto.randomUUID() },
    )
    return { res, attempt }
  }
  // The attempt of whoever `headers` signs in as, started with the normal limits.
  const startedFor = async (headers: Record<string, string>) => {
    await request(env, 'POST', '/api/v1/attempts', headers)
    const [attempt] = await testDb.select().from(attempts)
    return { attempt: attempt! }
  }

  it('limits saves per IP before the sign-in is checked', async () => {
    const { limiter, env } = withLimiter('ANSWER_IP_LIMIT', true)
    const id = crypto.randomUUID()
    const res = await request(env, 'PUT', `/api/v1/attempts/${id}/answers/${id}`, IP, {
      choiceId: id,
    })
    await expectRateLimited(res)
    expect(limiter.keys).toEqual(['203.0.113.7'])
  })

  it('limits saves per online respondent and saves nothing when refused', async () => {
    const user = await respondent()
    const { limiter, env } = withLimiter('ANSWER_LIMIT', true)
    const { res, attempt } = await saveFirst(env, user.headers)
    await expectRateLimited(res)
    expect(limiter.keys).toEqual([`profile:${user.id}`])
    expect(await testDb.select().from(answers).where(eq(answers.attemptId, attempt.id))).toEqual([])
  })

  it('limits saves per school student by their token’s hash', async () => {
    const link = await addSchoolLink()
    const joined = await request(
      env,
      'POST',
      `/api/v1/links/${link.code}/respondents`,
      IP,
      joinBody('C23-01-4004-MAN121'),
    )
    const { token } = (await joined.json()) as { token: string }
    const { limiter, env: counting } = withLimiter('ANSWER_LIMIT')
    await saveFirst(counting, { [RESPONDENT_TOKEN_HEADER]: token })
    expect(limiter.keys).toEqual([`token:${await sha256Hex(token)}`])
  })
})

describe('respondent actions', () => {
  it('limits starting per respondent and starts nothing when refused', async () => {
    const user = await respondent()
    const { limiter, env } = withLimiter('RESPONDENT_ACTION_LIMIT', true)
    await expectRateLimited(await request(env, 'POST', '/api/v1/attempts', user.headers))
    expect(limiter.keys).toEqual([`start:profile:${user.id}`])
    expect(await attemptsOf(user.respondentId)).toEqual([])
  })

  it('limits submitting and the SUS under their own keys', async () => {
    const { user, attempt } = await started()
    const { limiter, env } = withLimiter('RESPONDENT_ACTION_LIMIT', true)
    await expectRateLimited(
      await request(env, 'POST', `/api/v1/attempts/${attempt.id}/submit`, user.headers),
    )
    await expectRateLimited(
      await request(env, 'POST', `/api/v1/attempts/${attempt.id}/sus`, user.headers, {
        answers: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
      }),
    )
    expect(limiter.keys).toEqual([`submit:profile:${user.id}`, `sus:profile:${user.id}`])
    const [row] = await attemptsOf(user.respondentId)
    expect(row!.status).toBe('in_progress')
  })

  it('limits saving the online profile per account', async () => {
    const user = await respondent()
    const { limiter, env } = withLimiter('RESPONDENT_ACTION_LIMIT', true)
    await expectRateLimited(await request(env, 'POST', '/api/v1/respondents', user.headers, {}))
    expect(limiter.keys).toEqual([`respondent:profile:${user.id}`])
  })
})
