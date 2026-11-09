import { describe, expect, it } from 'vitest'
import { lessonResourceSchema, lessonSlugSchema, levelsForLessonTier } from './lesson'

describe('lessonSlugSchema', () => {
  it('takes lowercase words joined by single dashes', () => {
    for (const slug of ['search-smart', 'lesson-2', 'scams']) {
      expect(lessonSlugSchema.safeParse(slug).success).toBe(true)
    }
  })

  it('refuses capitals, spaces, double or edge dashes and other characters', () => {
    for (const slug of [
      'Search-smart',
      'search smart',
      'search--smart',
      '-search',
      'search-',
      'a/b',
      '',
      'a'.repeat(81),
    ]) {
      expect(lessonSlugSchema.safeParse(slug).success).toBe(false)
    }
  })
})

describe('lessonResourceSchema', () => {
  it('takes a name and an http(s) link, trimming the name', () => {
    expect(lessonResourceSchema.parse({ label: ' NPC ', url: 'https://privacy.gov.ph' })).toEqual({
      label: 'NPC',
      url: 'https://privacy.gov.ph',
    })
  })

  it('refuses an empty name and links that are not http(s)', () => {
    expect(lessonResourceSchema.safeParse({ label: ' ', url: 'https://a.ph' }).success).toBe(false)
    for (const url of ['javascript:alert(1)', 'ftp://a.ph', 'privacy.gov.ph']) {
      expect(lessonResourceSchema.safeParse({ label: 'A', url }).success).toBe(false)
    }
  })
})

describe('levelsForLessonTier', () => {
  it('lists the levels each tier is recommended for, as in the PRD', () => {
    expect(levelsForLessonTier('foundations')).toEqual(['beginner', 'basic'])
    expect(levelsForLessonTier('intermediate')).toEqual(['basic', 'intermediate'])
    expect(levelsForLessonTier('advanced')).toEqual(['intermediate', 'advanced'])
  })
})
