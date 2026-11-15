// School links, with no sign-in: opening one, joining it, and the respondent token.
import { attempts, respondents, schoolLinks } from '@digibridge/db'
import {
  LINK_GONE_MESSAGES,
  ONLINE_CONSENT_NOTICE,
  RESPONDENT_TOKEN_HEADER,
  RESPONDENT_TOKEN_REGEX,
  SCHOOL_CONSENT_NOTICE,
} from '@digibridge/shared'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { app } from '../app'
import { hashRespondentToken } from '../lib/respondent-token'
import { env, signedIn, testDb, addSchoolLink } from './helpers'
import { json, get, useQuestionBank, respondent, voidedFields, start, attemptsOf } from './fixtures'

useQuestionBank()

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
    for (const body of [profileFor({ consentVersion: ONLINE_CONSENT_NOTICE.version }), noNumber]) {
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

  describe('after the team voided their attempt (USR-03)', () => {
    /** A student who joined and started, with their attempt then voided. */
    const voidedStudent = async (link: { code: string }, studentNumber: string) => {
      const student = await joined(link, { studentNumber })
      expect((await start(student.headers)).status).toBe(201)
      await testDb
        .update(attempts)
        .set(voidedFields())
        .where(eq(attempts.respondentId, student.respondentId))
      return student
    }

    it('lets them join again with the same number, through another link, with a new token', async () => {
      const a = await addSchoolLink()
      const b = await addSchoolLink()
      const old = await voidedStudent(a, 'C23-01-7557-MAN121')
      const res = await join(
        b.code,
        profileFor({ studentNumber: 'c23-01-7557-man121', fullName: 'Ana Reyes', yearLevel: 3 }),
      )
      expect(res.status).toBe(201)
      const body = (await res.json()) as Joined
      expect(body.respondent).toEqual({ id: old.respondentId, fullName: 'Ana Reyes' })

      const [row] = await linkRespondents(b.id)
      expect(row).toMatchObject({
        id: old.respondentId,
        yearLevel: 3,
        accessTokenHash: await hashRespondentToken(body.token),
      })
      expect(await linkRespondents(a.id)).toHaveLength(0)
      // The old browser loses its place; the new token starts a new attempt from link b.
      expect((await openLink(a.code, old.headers)).status).toBe(401)
      expect((await start(old.headers)).status).toBe(401)
      expect((await start(tokenHeader(body.token))).status).toBe(201)
      const current = (await attemptsOf(old.respondentId)).find((t) => t.status !== 'voided')
      expect(current).toMatchObject({ status: 'in_progress', schoolLinkId: b.id })
    })

    it('lets them back into a full link they already count on, but no one new', async () => {
      const link = await addSchoolLink({ maxResponses: 1 })
      await voidedStudent(link, 'C23-01-7557-MAN121')
      expect((await join(link.code, profileFor())).status).toBe(410)
      const res = await join(link.code, profileFor({ studentNumber: 'C23-01-7557-MAN121' }))
      expect(res.status).toBe(201)
      expect(await linkRespondents(link.id)).toHaveLength(1)
    })

    it('still refuses a number whose attempt isn’t voided', async () => {
      const link = await addSchoolLink()
      const student = await joined(link, { studentNumber: 'C23-01-7557-MAN121' })
      const { id } = (await (await start(student.headers)).json()) as { id: string }
      await app.request(
        `/api/v1/attempts/${id}/submit`,
        { method: 'POST', headers: student.headers },
        env,
      )
      // One voided attempt and a later one in place: still taken.
      await testDb.insert(attempts).values({
        respondentId: student.respondentId,
        schoolLinkId: link.id,
        ...voidedFields(),
        expiresAt: new Date(),
        questionOrder: [],
        choiceOrder: {},
      })
      const res = await join(link.code, profileFor({ studentNumber: 'C23-01-7557-MAN121' }))
      expect(res.status).toBe(409)
    })
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
