import { attempts, choices, lessons, questions } from '@digibridge/db'
import { ATTEMPT_DURATION_MINUTES, ITEMS_PER_ATTEMPT } from '@digibridge/shared'
import { eq, inArray } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { signedIn, testDb } from './helpers'
import {
  areaId,
  choicesOf,
  respondent,
  rightChoice,
  send,
  useQuestionBank,
  wrongChoice,
} from './fixtures'

useQuestionBank()

type PreviewAttempt = {
  id: string
  status: string
  startedAt: string
  expiresAt: string
  items: { id: string; area: string; choices: { id: string; label: string }[] }[]
  answers: unknown[]
}

type PreviewResult = {
  areas: { area: string; level: string; lessons: unknown[] }[]
}

const startPreview = (headers: Record<string, string>) =>
  send('POST', '/api/v1/preview/attempts', headers)
const previewResult = (headers: Record<string, string>, body: unknown) =>
  send('POST', '/api/v1/preview/result', headers, body)

/** A staff member and the sample assessment they got. */
async function previewing(role: 'admin' | 'facilitator' = 'admin') {
  const user = await signedIn(role)
  const res = await startPreview(user.headers)
  return { user, preview: (await res.json()) as PreviewAttempt }
}

describe('POST /api/v1/preview/attempts', () => {
  it('gives staff a shuffled sample assessment and saves nothing', async () => {
    for (const role of ['admin', 'facilitator'] as const) {
      const user = await signedIn(role)
      const res = await startPreview(user.headers)
      expect(res.status).toBe(201)
      const body = (await res.json()) as PreviewAttempt
      expect(body.status).toBe('in_progress')
      expect(body.items).toHaveLength(ITEMS_PER_ATTEMPT)
      expect(body.answers).toEqual([])
      expect(Date.parse(body.expiresAt) - Date.parse(body.startedAt)).toBe(
        ATTEMPT_DURATION_MINUTES * 60_000,
      )
      for (const item of body.items) {
        expect(item.choices).toHaveLength(4)
        // No right answers or difficulty (RES-05).
        expect(item).not.toHaveProperty('difficulty')
        for (const choice of item.choices) expect(choice).not.toHaveProperty('isCorrect')
      }
      // Active items only.
      const rows = await testDb
        .select({ isActive: questions.isActive })
        .from(questions)
        .where(
          inArray(
            questions.id,
            body.items.map((i) => i.id),
          ),
        )
      expect(rows.every((r) => r.isActive)).toBe(true)
    }
    expect(await testDb.select().from(attempts)).toEqual([])
  })

  it('is for staff only', async () => {
    const { headers } = await respondent()
    expect((await startPreview(headers)).status).toBe(403)
    expect((await startPreview({})).status).toBe(401)
  })

  it('answers 409 when an area has too few active items', async () => {
    const { headers } = await signedIn('admin')
    await testDb
      .update(questions)
      .set({ isActive: false })
      .where(eq(questions.areaId, await areaId('safety')))
    const res = await startPreview(headers)
    expect(res.status).toBe(409)
  })
})

describe('POST /api/v1/preview/result', () => {
  it('scores the answers with levels and lessons per area, and saves nothing', async () => {
    const { user, preview } = await previewing('facilitator')
    const areaOf = new Map(preview.items.map((i) => [i.id, i.area]))
    // Every information item right (Advanced), every other one wrong or blank (Beginner).
    const answers = await Promise.all(
      preview.items.slice(0, 20).map(async (item) => ({
        questionId: item.id,
        choiceId:
          areaOf.get(item.id) === 'info_literacy'
            ? await rightChoice(item.id)
            : await wrongChoice(item.id),
      })),
    )
    const info = preview.items.filter((i) => i.area === 'info_literacy')
    for (const item of info) {
      if (!answers.some((a) => a.questionId === item.id)) {
        answers.push({ questionId: item.id, choiceId: await rightChoice(item.id) })
      }
    }
    await testDb.insert(lessons).values({
      slug: 'safety-foundations',
      title: 'Staying safe',
      summary: 'The basics',
      areaId: await areaId('safety'),
      tier: 'foundations',
      bodyMd: '#',
      isPublished: true,
    })

    const res = await previewResult(user.headers, {
      id: preview.id,
      questionIds: preview.items.map((i) => i.id),
      answers,
      timeUp: false,
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as PreviewResult
    expect(body).toMatchObject({
      id: preview.id,
      status: 'submitted',
      overall: { points: 18, maxPoints: 54, pct: 33.33, level: 'beginner' },
      resultsToken: null,
      susAnswered: false,
    })
    expect(body.areas.map((a) => [a.area, a.level])).toEqual([
      ['info_literacy', 'advanced'],
      ['communication', 'beginner'],
      ['safety', 'beginner'],
    ])
    const safety = body.areas[2]!
    expect(safety.lessons).toEqual([
      {
        tier: 'foundations',
        nextStep: false,
        lesson: { slug: 'safety-foundations', title: 'Staying safe', summary: 'The basics' },
      },
    ])
    expect(await testDb.select().from(attempts)).toEqual([])
  })

  it('reads expired when time ran out', async () => {
    const { user, preview } = await previewing()
    const res = await previewResult(user.headers, {
      id: preview.id,
      questionIds: preview.items.map((i) => i.id),
      answers: [],
      timeUp: true,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'expired', overall: { points: 0 } })
  })

  it('refuses an answer outside the list or a choice of another question', async () => {
    const { user, preview } = await previewing()
    const [first, second] = preview.items
    const questionIds = preview.items.slice(1).map((i) => i.id)
    const outside = await previewResult(user.headers, {
      id: preview.id,
      questionIds,
      answers: [{ questionId: first!.id, choiceId: await rightChoice(first!.id) }],
      timeUp: false,
    })
    expect(outside.status).toBe(400)
    const otherChoice = await previewResult(user.headers, {
      id: preview.id,
      questionIds,
      answers: [{ questionId: second!.id, choiceId: (await choicesOf(first!.id))[0]!.id }],
      timeUp: false,
    })
    expect(otherChoice.status).toBe(400)
  })

  it('answers 409 once a question was deleted', async () => {
    const { user, preview } = await previewing()
    const gone = preview.items[0]!.id
    await testDb.delete(choices).where(eq(choices.questionId, gone))
    await testDb.delete(questions).where(eq(questions.id, gone))
    const res = await previewResult(user.headers, {
      id: preview.id,
      questionIds: preview.items.map((i) => i.id),
      answers: [],
      timeUp: false,
    })
    expect(res.status).toBe(409)
  })

  it('is for staff only', async () => {
    const { preview } = await previewing()
    const { headers } = await respondent()
    const body = { id: preview.id, questionIds: [preview.items[0]!.id], answers: [], timeUp: false }
    expect((await previewResult(headers, body)).status).toBe(403)
    expect((await previewResult({}, body)).status).toBe(401)
  })
})
