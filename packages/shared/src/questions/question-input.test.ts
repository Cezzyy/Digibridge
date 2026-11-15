import { describe, expect, it } from 'vitest'
import { correctChoiceIndex, QUESTION_STEM_MAX, questionInputSchema } from './question-input'

describe('questionInputSchema', () => {
  const question = {
    area: 'safety',
    difficulty: 'basic',
    stem: '  You get a text:\n\n“Your account is locked. Tap here.”\n\nWhat should you do?  ',
    imageUrl: null,
    isScenario: true,
    explanation: ' Banks never send links like this. ',
    choices: [
      { label: ' Tap the link ', isCorrect: false },
      { label: 'Call the bank’s own number', isCorrect: true },
      { label: 'Reply with your PIN', isCorrect: false },
      { label: 'Forward it to friends', isCorrect: false },
    ],
    isActive: true,
  }

  it('takes a whole question, trimming the text but keeping blank lines inside the stem', () => {
    const parsed = questionInputSchema.parse(question)
    expect(parsed.stem).toBe(
      'You get a text:\n\n“Your account is locked. Tap here.”\n\nWhat should you do?',
    )
    expect(parsed.explanation).toBe('Banks never send links like this.')
    expect(parsed.choices[0]!.label).toBe('Tap the link')
  })

  it('saves an empty explanation as null', () => {
    expect(questionInputSchema.parse({ ...question, explanation: '  ' }).explanation).toBeNull()
  })

  it('refuses a blank or too long stem, and a blank choice', () => {
    for (const bad of [
      { stem: ' \n ' },
      { stem: 'a'.repeat(QUESTION_STEM_MAX + 1) },
      { choices: question.choices.map((c, i) => (i === 2 ? { ...c, label: ' ' } : c)) },
    ]) {
      expect(questionInputSchema.safeParse({ ...question, ...bad }).success).toBe(false)
    }
  })

  it('needs exactly 4 choices with exactly 1 right (CMS-03)', () => {
    for (const choices of [
      question.choices.slice(0, 3),
      [...question.choices, { label: 'Ignore it', isCorrect: false }],
      question.choices.map((c) => ({ ...c, isCorrect: false })),
      question.choices.map((c, i) => ({ ...c, isCorrect: i < 2 })),
    ]) {
      expect(questionInputSchema.safeParse({ ...question, choices }).success).toBe(false)
    }
  })

  it('refuses two choices that say the same thing, pointing at the second', () => {
    const result = questionInputSchema.safeParse({
      ...question,
      choices: question.choices.map((c, i) => (i === 3 ? { ...c, label: 'TAP THE LINK' } : c)),
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['choices', 3, 'label'])
  })

  it('refuses an image link that is not https', () => {
    const result = questionInputSchema.safeParse({ ...question, imageUrl: 'http://a.com/b.png' })
    expect(result.success).toBe(false)
  })
})

describe('correctChoiceIndex', () => {
  it('finds the right choice, or -1', () => {
    expect(correctChoiceIndex([{ isCorrect: false }, { isCorrect: true }])).toBe(1)
    expect(correctChoiceIndex([{ isCorrect: false }])).toBe(-1)
  })
})
