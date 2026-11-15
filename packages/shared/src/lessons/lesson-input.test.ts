import { describe, expect, it } from 'vitest'
import { LESSON_SLUG_MAX, lessonSlugSchema } from './lesson'
import { LESSON_RESOURCES_MAX, lessonInputSchema, slugFromTitle } from './lesson-input'

describe('lessonInputSchema', () => {
  const lesson = {
    area: 'safety',
    tier: 'foundations',
    slug: 'spot-scams',
    title: ' Spot scams ',
    summary: ' Tell a scam from a real message. ',
    bodyMd: '## What you’ll learn\n\n- One thing',
    imageUrl: null,
    videoUrl: 'https://www.youtube.com/watch?v=abc',
    resources: [{ label: 'NPC', url: 'https://privacy.gov.ph' }],
    isPublished: false,
  }

  it('takes a whole lesson, trimming the title and summary', () => {
    expect(lessonInputSchema.parse(lesson)).toEqual({
      ...lesson,
      title: 'Spot scams',
      summary: 'Tell a scam from a real message.',
    })
  })

  it('refuses a blank title, summary or body', () => {
    for (const blank of [{ title: ' ' }, { summary: '' }, { bodyMd: ' \n ' }]) {
      expect(lessonInputSchema.safeParse({ ...lesson, ...blank }).success).toBe(false)
    }
  })

  it('refuses links that are not http(s), and too many resources', () => {
    for (const bad of [
      { imageUrl: 'javascript:alert(1)' },
      { videoUrl: 'youtube.com/watch?v=abc' },
      {
        resources: Array.from({ length: LESSON_RESOURCES_MAX + 1 }, () => lesson.resources[0]),
      },
    ]) {
      expect(lessonInputSchema.safeParse({ ...lesson, ...bad }).success).toBe(false)
    }
  })
})

describe('slugFromTitle', () => {
  it('turns a title into a slug', () => {
    expect(slugFromTitle('Spot scams & phishing!')).toBe('spot-scams-phishing')
    expect(slugFromTitle('What you’ll learn about Señor Café')).toBe(
      'what-youll-learn-about-senor-cafe',
    )
    expect(slugFromTitle('  --  ')).toBe('')
  })

  it('cuts a long title at a dash to fit, and the result is a valid slug', () => {
    const slug = slugFromTitle('word '.repeat(40))
    expect(slug.length).toBeLessThanOrEqual(LESSON_SLUG_MAX)
    expect(slug.endsWith('-')).toBe(false)
    expect(lessonSlugSchema.safeParse(slug).success).toBe(true)
  })
})
