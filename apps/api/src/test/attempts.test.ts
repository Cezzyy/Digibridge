import { answers, areaResults, attempts, choices, questions } from '@digibridge/db'
import {
  ANSWER_GRACE_SECONDS,
  ATTEMPT_DURATION_MINUTES,
  CHOICES_PER_QUESTION,
  ITEMS_PER_ATTEMPT,
} from '@digibridge/shared'
import { eq, inArray } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { addQuestionBank, clearQuestionBank, signedIn, testDb } from './helpers'
import {
  get,
  useQuestionBank,
  respondent,
  voidedFields,
  start,
  attemptsOf,
  read,
  save,
  submit,
  started,
  rightChoice,
  wrongChoice,
  setExpiresAt,
} from './fixtures'

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
      .set({ ...voidedFields(), voidNote: 'Lost connection' })
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
  useQuestionBank()

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
        .set({ ...voidedFields(), voidNote: 'Test' })
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
})
