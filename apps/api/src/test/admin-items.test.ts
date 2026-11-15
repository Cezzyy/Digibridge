import { choices, questions } from '@digibridge/db'
import { CHOICES_PER_QUESTION } from '@digibridge/shared'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { app } from '../app'
import { env, signedIn, testDb } from './helpers'
import { get, useQuestionBank, respondent, start, attemptsOf } from './fixtures'

useQuestionBank()

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
