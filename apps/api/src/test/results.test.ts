import { attempts, competencyAreas, lessons, questions, susResponses } from '@digibridge/db'
import { ANSWER_GRACE_SECONDS } from '@digibridge/shared'
import { eq, inArray } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { signedIn, testDb } from './helpers'
import {
  get,
  useQuestionBank,
  respondent,
  voidedFields,
  save,
  submit,
  started,
  rightChoice,
  setExpiresAt,
  areaId,
} from './fixtures'

useQuestionBank()

describe('GET /api/v1/attempts/:id/result', () => {
  const result = (id: string, headers: Record<string, string> = {}) =>
    get(`/api/v1/attempts/${id}/result`, headers)

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
      .set({ ...voidedFields(), voidReason: 'Test' })
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
