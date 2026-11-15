// The admin overview and school links.
import { attempts, respondents, schoolLinks } from '@digibridge/db'
import {
  addDays,
  LINK_CODE_ALPHABET,
  LINK_CODE_LENGTH,
  linkExpiresAt,
  todayInPhilippines,
} from '@digibridge/shared'
import { describe, expect, it } from 'vitest'
import { signedIn, testDb, addSchoolLink } from './helpers'
import { get, send, base, school, withStatus } from './fixtures'

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
    ...withStatus(status),
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
    expect((await send('POST', `/api/v1/admin/links/${link.id}/close`, staff.headers)).status).toBe(
      403,
    )
  })
})
