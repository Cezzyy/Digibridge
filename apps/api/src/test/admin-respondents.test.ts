import { answers, areaResults, choices, profiles, respondents, susResponses } from '@digibridge/db'
import { AREA_CODES, RESPONDENT_TOKEN_HEADER, SCHOOL_CONSENT_NOTICE } from '@digibridge/shared'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { app } from '../app'
import { env, signedIn, testDb, addSchoolLink } from './helpers'
import {
  get,
  useQuestionBank,
  respondent,
  school,
  linkFor,
  addSchoolRespondent,
  start,
  attemptsOf,
} from './fixtures'

useQuestionBank()

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
    const scored = await addSchoolRespondent({}, { status: 'submitted', linkId: link.id, pct: 50 })
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
describe('POST /api/v1/admin/attempts/:id/void', () => {
  const voidIt = (id: string, body: unknown, headers: Record<string, string>) =>
    app.request(
      `/api/v1/admin/attempts/${id}/void`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      env,
    )
  /** An online respondent who started and submitted. */
  const submitted = async () => {
    const user = await respondent()
    const { id } = (await (await start(user.headers)).json()) as { id: string }
    await app.request(
      `/api/v1/attempts/${id}/submit`,
      { method: 'POST', headers: user.headers },
      env,
    )
    return { user, id }
  }

  it('voids a finished attempt with its reason, and the respondent can start again (USR-03)', async () => {
    const { user, id } = await submitted()
    const admin = await signedIn('admin')
    const res = await voidIt(id, { reason: 'duplicate', note: ' Second account ' }, admin.headers)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      attempt: {
        id,
        status: 'voided',
        voidReason: 'duplicate',
        voidNote: 'Second account',
        voidedAt: expect.any(String),
      },
    })
    const [row] = await attemptsOf(user.respondentId)
    expect(row).toMatchObject({ status: 'voided', voidedBy: admin.id })
    // The scores stay for the record.
    expect(row!.overallLevel).not.toBeNull()

    const detail = await get(`/api/v1/admin/respondents/${user.respondentId}`, admin.headers)
    expect(await detail.json()).toMatchObject({
      respondent: { status: 'voided', overallPct: null },
      attempt: { status: 'voided', voidReason: 'duplicate', voidNote: 'Second account' },
    })
    expect((await get(`/api/v1/attempts/${id}/result`, user.headers)).status).toBe(409)
    expect((await start(user.headers)).status).toBe(201)
  })

  it('stops an attempt in progress taking answers', async () => {
    const user = await respondent()
    const { id } = (await (await start(user.headers)).json()) as { id: string }
    const admin = await signedIn('admin')
    expect((await voidIt(id, { reason: 'technical' }, admin.headers)).status).toBe(200)

    const [attempt] = await attemptsOf(user.respondentId)
    expect(attempt).toMatchObject({ voidReasonCode: 'technical', voidNote: null })
    const questionId = attempt!.questionOrder[0]!
    const saved = await app.request(
      `/api/v1/attempts/${id}/answers/${questionId}`,
      {
        method: 'PUT',
        headers: { ...user.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ choiceId: attempt!.choiceOrder[questionId]![0] }),
      },
      env,
    )
    expect(saved.status).toBe(409)
  })

  it('ends a school-link student’s token, so whoever has the number joins again to start over', async () => {
    const link = await addSchoolLink()
    const joinAs = (fullName: string) =>
      app.request(
        `/api/v1/links/${link.code}/respondents`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName,
            birthDate: '2007-06-15',
            sex: 'female',
            devices: ['smartphone'],
            internetAccess: ['mobile_data'],
            studentNumber: 'C23-01-7001-MAN121',
            course: 'BSIT',
            yearLevel: 2,
            showIdentity: true,
            consentVersion: SCHOOL_CONSENT_NOTICE.version,
          }),
        },
        env,
      )
    // Someone joins under another student's number and starts.
    const first = (await (await joinAs('Wrong Person')).json()) as { token: string }
    const wrong = { [RESPONDENT_TOKEN_HEADER]: first.token }
    const { id } = (await (await start(wrong)).json()) as { id: string }
    const admin = await signedIn('admin')
    expect((await voidIt(id, { reason: 'wrong_person' }, admin.headers)).status).toBe(200)

    // Their browser can't start again under that number…
    expect((await get(`/api/v1/links/${link.code}`, wrong)).status).toBe(401)
    expect((await start(wrong)).status).toBe(401)
    expect((await get(`/api/v1/attempts/${id}`, wrong)).status).toBe(404)
    // …and the student it belongs to can still join with it.
    const res = await joinAs('Right Person')
    expect(res.status).toBe(201)
    const second = (await res.json()) as { token: string }
    expect((await start({ [RESPONDENT_TOKEN_HEADER]: second.token })).status).toBe(201)
  })

  it('needs a note with other, and a known reason', async () => {
    const { id } = await submitted()
    const admin = await signedIn('admin')
    for (const body of [
      { reason: 'other' },
      { reason: 'other', note: '  ' },
      { reason: 'bored' },
    ]) {
      expect((await voidIt(id, body, admin.headers)).status).toBe(400)
    }
    expect((await voidIt(id, { reason: 'other', note: 'Fire drill' }, admin.headers)).status).toBe(
      200,
    )
  })

  it('answers 409 when already voided and 404 for an unknown attempt', async () => {
    const { id } = await submitted()
    const admin = await signedIn('admin')
    expect((await voidIt(id, { reason: 'technical' }, admin.headers)).status).toBe(200)
    const again = await voidIt(id, { reason: 'test_entry' }, admin.headers)
    expect(again.status).toBe(409)
    expect(await again.json()).toMatchObject({ error: { code: 'conflict' } })
    expect((await voidIt(crypto.randomUUID(), { reason: 'technical' }, admin.headers)).status).toBe(
      404,
    )
  })

  it('is for admins only', async () => {
    const { user, id } = await submitted()
    const staff = await signedIn('facilitator')
    for (const headers of [staff.headers, user.headers]) {
      expect((await voidIt(id, { reason: 'technical' }, headers)).status).toBe(403)
    }
    const [row] = await attemptsOf(user.respondentId)
    expect(row!.status).toBe('submitted')
  })
})

describe('DELETE /api/v1/admin/respondents/:id', () => {
  const remove = (id: string, headers: Record<string, string>) =>
    app.request(`/api/v1/admin/respondents/${id}`, { method: 'DELETE', headers }, env)

  it('deletes the respondent with their attempt, answers, results and survey (USR-03)', async () => {
    const user = await respondent()
    const { id } = (await (await start(user.headers)).json()) as { id: string }
    const [attempt] = await attemptsOf(user.respondentId)
    const questionId = attempt!.questionOrder[0]!
    const json = { ...user.headers, 'Content-Type': 'application/json' }
    await app.request(
      `/api/v1/attempts/${id}/answers/${questionId}`,
      {
        method: 'PUT',
        headers: json,
        body: JSON.stringify({ choiceId: attempt!.choiceOrder[questionId]![0] }),
      },
      env,
    )
    await app.request(
      `/api/v1/attempts/${id}/submit`,
      { method: 'POST', headers: user.headers },
      env,
    )
    await app.request(
      `/api/v1/attempts/${id}/sus`,
      {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ answers: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3] }),
      },
      env,
    )

    const admin = await signedIn('admin')
    const res = await remove(user.respondentId, admin.headers)
    expect(res.status).toBe(204)
    expect(
      (await get(`/api/v1/admin/respondents/${user.respondentId}`, admin.headers)).status,
    ).toBe(404)
    expect(await attemptsOf(user.respondentId)).toHaveLength(0)
    for (const table of [answers, areaResults, susResponses]) {
      expect(await testDb.select().from(table).where(eq(table.attemptId, id))).toHaveLength(0)
    }
    // The Google account stays: signing in again starts over from the notice.
    expect(await testDb.select().from(profiles).where(eq(profiles.id, user.id))).toHaveLength(1)
    expect(await (await get('/api/v1/me', user.headers)).json()).toMatchObject({
      respondent: null,
      attempt: null,
    })
  })

  it('frees a school-link student’s place on the link', async () => {
    const link = await addSchoolLink({ maxResponses: 1 })
    const row = await addSchoolRespondent({ schoolLinkId: link.id })
    expect(await (await get(`/api/v1/links/${link.code}`)).json()).toMatchObject({
      error: { code: 'gone' },
    })
    const admin = await signedIn('admin')
    expect((await remove(row.id, admin.headers)).status).toBe(204)
    expect((await get(`/api/v1/links/${link.code}`)).status).toBe(200)
  })

  it('answers 404 for an unknown respondent and is for admins only', async () => {
    const admin = await signedIn('admin')
    expect((await remove(crypto.randomUUID(), admin.headers)).status).toBe(404)
    const user = await respondent()
    const staff = await signedIn('facilitator')
    for (const headers of [staff.headers, user.headers]) {
      expect((await remove(user.respondentId, headers)).status).toBe(403)
    }
    expect(
      await testDb.select().from(respondents).where(eq(respondents.id, user.respondentId)),
    ).toHaveLength(1)
  })
})
