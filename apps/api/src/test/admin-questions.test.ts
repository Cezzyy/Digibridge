import { attempts, choices, questions } from '@digibridge/db'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { choicesOf, get, send, started, useQuestionBank, voidedFields } from './fixtures'
import { clearQuestionBank, signedIn, testDb } from './helpers'

useQuestionBank()

type Choice = { id: string; label: string; isCorrect: boolean }
type Question = {
  id: string
  area: string
  difficulty: string
  stem: string
  shown: boolean
  isActive: boolean
  choices: Choice[]
}

describe('admin questions editor (CMS-01 to CMS-03)', () => {
  const input = {
    area: 'safety',
    difficulty: 'intermediate',
    stem: ' A text says your account is locked. What should you do? ',
    imageUrl: null,
    isScenario: true,
    explanation: '',
    choices: [
      { label: 'Tap the link', isCorrect: false },
      { label: 'Call the bank’s own number', isCorrect: true },
      { label: 'Reply with your PIN', isCorrect: false },
      { label: 'Forward it to friends', isCorrect: false },
    ],
    isActive: true,
  }

  /** A question no attempt has shown yet: inactive ones never go into an attempt. */
  const unshown = async () => {
    const [row] = await testDb
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.isActive, false))
      .limit(1)
    return row!.id
  }

  /** A question a started attempt shows. */
  const shownQuestion = async () => {
    const { attempt } = await started()
    return { id: attempt.questionOrder[0]!, attempt }
  }

  const readQuestion = async (id: string, headers: Record<string, string>) =>
    (await (await get(`/api/v1/admin/questions/${id}`, headers)).json()) as Question

  describe('GET /api/v1/admin/questions', () => {
    it('lists every question by area and difficulty, marking the ones an attempt showed', async () => {
      const { attempt } = await started()
      const admin = await signedIn('admin')
      const res = await get('/api/v1/admin/questions', admin.headers)
      expect(res.status).toBe(200)
      const { questions: list } = (await res.json()) as { questions: Question[] }
      // 3 areas × (5 basic + 5 intermediate + 3 advanced) with the inactive ones.
      expect(list).toHaveLength(39)
      expect(list.slice(0, 5).map((q) => `${q.area} ${q.difficulty}`)).toEqual(
        Array(5).fill('info_literacy basic'),
      )
      expect(
        list
          .filter((q) => q.shown)
          .map((q) => q.id)
          .sort(),
      ).toEqual([...attempt.questionOrder].sort())
      expect(list[0]).toEqual({
        id: expect.any(String),
        area: 'info_literacy',
        difficulty: 'basic',
        stem: 'info_literacy basic 0',
        imageUrl: null,
        isScenario: false,
        isActive: true,
        shown: true,
        updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      })
    })

    it('refuses facilitators', async () => {
      const staff = await signedIn('facilitator')
      expect((await get('/api/v1/admin/questions', staff.headers)).status).toBe(403)
    })
  })

  describe('GET /api/v1/admin/questions/:id', () => {
    it('sends the question with its choices in position order and the right one marked', async () => {
      const id = await unshown()
      const admin = await signedIn('admin')
      const res = await get(`/api/v1/admin/questions/${id}`, admin.headers)
      expect(res.status).toBe(200)
      const question = (await res.json()) as Question & { explanation: string | null }
      expect(question).toMatchObject({ id, isActive: false, shown: false, explanation: null })
      expect(question.choices.map((c) => [c.label, c.isCorrect])).toEqual([
        ['Choice 1', true],
        ['Choice 2', false],
        ['Choice 3', false],
        ['Choice 4', false],
      ])
    })

    it('is 404 for an unknown question', async () => {
      const admin = await signedIn('admin')
      const res = await get(`/api/v1/admin/questions/${crypto.randomUUID()}`, admin.headers)
      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/v1/admin/questions', () => {
    it('adds a question with its 4 choices, trimmed, by the admin', async () => {
      const admin = await signedIn('admin')
      const res = await send('POST', '/api/v1/admin/questions', admin.headers, input)
      expect(res.status).toBe(201)
      const created = (await res.json()) as Question & { explanation: string | null }
      expect(created).toMatchObject({
        area: 'safety',
        difficulty: 'intermediate',
        stem: 'A text says your account is locked. What should you do?',
        isScenario: true,
        explanation: null,
        shown: false,
      })
      expect(created.choices.map((c) => c.isCorrect)).toEqual([false, true, false, false])

      const [row] = await testDb.select().from(questions).where(eq(questions.id, created.id))
      expect(row!.createdBy).toBe(admin.id)
      expect(await choicesOf(created.id)).toHaveLength(4)
    })

    it('refuses anything but exactly 4 choices with exactly 1 right (CMS-03)', async () => {
      const admin = await signedIn('admin')
      for (const bad of [
        input.choices.slice(0, 3),
        input.choices.map((c) => ({ ...c, isCorrect: true })),
        input.choices.map((c) => ({ ...c, isCorrect: false })),
      ]) {
        const res = await send('POST', '/api/v1/admin/questions', admin.headers, {
          ...input,
          choices: bad,
        })
        expect(res.status).toBe(400)
      }
    })

    it('is 404 when the areas were never seeded', async () => {
      const admin = await signedIn('admin')
      await clearQuestionBank()
      const res = await send('POST', '/api/v1/admin/questions', admin.headers, input)
      expect(res.status).toBe(404)
    })

    it('refuses facilitators', async () => {
      const staff = await signedIn('facilitator')
      const res = await send('POST', '/api/v1/admin/questions', staff.headers, input)
      expect(res.status).toBe(403)
    })
  })

  describe('PATCH /api/v1/admin/questions/:id', () => {
    it('moves an unshown question’s area, difficulty and right choice, keeping choice IDs', async () => {
      const id = await unshown()
      const admin = await signedIn('admin')
      const before = await readQuestion(id, admin.headers)
      const res = await send('PATCH', `/api/v1/admin/questions/${id}`, admin.headers, {
        area: 'communication',
        difficulty: 'advanced',
        choices: before.choices.map((_, i) => ({ label: `New ${i}`, isCorrect: i === 3 })),
      })
      expect(res.status).toBe(200)
      const updated = (await res.json()) as Question
      expect(updated).toMatchObject({ area: 'communication', difficulty: 'advanced' })
      expect(updated.choices).toEqual(
        before.choices.map((c, i) => ({ id: c.id, label: `New ${i}`, isCorrect: i === 3 })),
      )
    })

    it('lets a shown question’s wording change and be made inactive', async () => {
      const { id } = await shownQuestion()
      const admin = await signedIn('admin')
      const before = await readQuestion(id, admin.headers)
      const res = await send('PATCH', `/api/v1/admin/questions/${id}`, admin.headers, {
        // The same area and difficulty sent back are not a change.
        area: before.area,
        difficulty: before.difficulty,
        stem: 'Reworded question',
        choices: before.choices.map((c) => ({ label: `${c.label}.`, isCorrect: c.isCorrect })),
        isActive: false,
      })
      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ stem: 'Reworded question', isActive: false })
    })

    it('locks a shown question’s area, difficulty and right choice (CMS-02)', async () => {
      const { id } = await shownQuestion()
      const admin = await signedIn('admin')
      const before = await readQuestion(id, admin.headers)
      for (const change of [
        { area: before.area === 'safety' ? 'communication' : 'safety' },
        { difficulty: before.difficulty === 'basic' ? 'advanced' : 'basic' },
        { choices: before.choices.map((c, i) => ({ label: c.label, isCorrect: i === 2 })) },
      ]) {
        const res = await send('PATCH', `/api/v1/admin/questions/${id}`, admin.headers, change)
        expect(res.status).toBe(409)
      }
      expect(await readQuestion(id, admin.headers)).toEqual(before)
    })

    it('counts a voided attempt as having shown it', async () => {
      const { id, attempt } = await shownQuestion()
      await testDb.update(attempts).set(voidedFields()).where(eq(attempts.id, attempt.id))
      const admin = await signedIn('admin')
      const { difficulty } = await readQuestion(id, admin.headers)
      const res = await send('PATCH', `/api/v1/admin/questions/${id}`, admin.headers, {
        difficulty: difficulty === 'basic' ? 'advanced' : 'basic',
      })
      expect(res.status).toBe(409)
    })

    it('is 404 for an unknown question, 400 for bad choices', async () => {
      const admin = await signedIn('admin')
      const unknown = await send(
        'PATCH',
        `/api/v1/admin/questions/${crypto.randomUUID()}`,
        admin.headers,
        { stem: 'x' },
      )
      expect(unknown.status).toBe(404)
      const bad = await send('PATCH', `/api/v1/admin/questions/${await unshown()}`, admin.headers, {
        choices: input.choices.slice(0, 2),
      })
      expect(bad.status).toBe(400)
    })
  })

  describe('DELETE /api/v1/admin/questions/:id', () => {
    it('deletes a question nobody has seen, with its choices', async () => {
      const id = await unshown()
      const admin = await signedIn('admin')
      const res = await send('DELETE', `/api/v1/admin/questions/${id}`, admin.headers)
      expect(res.status).toBe(204)
      expect(await testDb.select().from(questions).where(eq(questions.id, id))).toEqual([])
      expect(await testDb.select().from(choices).where(eq(choices.questionId, id))).toEqual([])
    })

    it('refuses a question an attempt has shown, and an unknown one', async () => {
      const { id } = await shownQuestion()
      const admin = await signedIn('admin')
      expect((await send('DELETE', `/api/v1/admin/questions/${id}`, admin.headers)).status).toBe(
        409,
      )
      const unknown = await send(
        'DELETE',
        `/api/v1/admin/questions/${crypto.randomUUID()}`,
        admin.headers,
      )
      expect(unknown.status).toBe(404)
    })
  })
})
