import { attempts, susResponses } from '@digibridge/db'
import { ANSWER_GRACE_SECONDS } from '@digibridge/shared'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { app } from '../app'
import { env, signedIn, testDb } from './helpers'
import {
  json,
  get,
  useQuestionBank,
  respondent,
  voidedFields,
  submit,
  started,
  setExpiresAt,
} from './fixtures'

useQuestionBank()

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
      .set({ ...voidedFields(), voidReason: 'Test' })
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
