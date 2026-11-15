// The public lesson library.
import { lessons } from '@digibridge/db'
import { beforeEach, describe, expect, it } from 'vitest'
import { testDb } from './helpers'
import { get, useQuestionBank, lessonRow } from './fixtures'

useQuestionBank()

describe('GET /api/v1/lessons', () => {
  beforeEach(async () => {
    // Inserted out of order, to check the sorting. One draft, which stays hidden.
    await testDb.insert(lessons).values([
      await lessonRow('safety-advanced', 'safety', 'advanced'),
      await lessonRow('info-intermediate', 'info_literacy', 'intermediate'),
      await lessonRow('safety-foundations', 'safety', 'foundations'),
      await lessonRow('info-foundations', 'info_literacy', 'foundations'),
      await lessonRow('communication-draft', 'communication', 'foundations', {
        isPublished: false,
      }),
    ])
  })

  it('lists the published lessons by area, then tier, without signing in (LES-01, LES-03)', async () => {
    const res = await get('/api/v1/lessons')
    expect(res.status).toBe(200)
    const { lessons: list } = (await res.json()) as { lessons: Record<string, unknown>[] }
    expect(list.map((l) => l.slug)).toEqual([
      'info-foundations',
      'info-intermediate',
      'safety-foundations',
      'safety-advanced',
    ])
    expect(list[0]).toEqual({
      slug: 'info-foundations',
      area: 'info_literacy',
      tier: 'foundations',
      title: 'Title of info-foundations',
      summary: 'Summary of info-foundations',
    })
  })

  it('filters by area and tier', async () => {
    const slugs = async (query: string) => {
      const res = await get(`/api/v1/lessons?${query}`)
      expect(res.status).toBe(200)
      return ((await res.json()) as { lessons: { slug: string }[] }).lessons.map((l) => l.slug)
    }
    expect(await slugs('area=safety')).toEqual(['safety-foundations', 'safety-advanced'])
    expect(await slugs('tier=foundations')).toEqual(['info-foundations', 'safety-foundations'])
    expect(await slugs('area=info_literacy&tier=advanced')).toEqual([])
  })

  it('answers 400 for an unknown area or tier', async () => {
    for (const query of ['area=math', 'tier=expert']) {
      const res = await get(`/api/v1/lessons?${query}`)
      expect(res.status).toBe(400)
    }
  })
})

describe('GET /api/v1/lessons/:slug', () => {
  it('sends the whole lesson without signing in (LES-02, LES-03)', async () => {
    const resources = [{ label: 'National Privacy Commission', url: 'https://privacy.gov.ph' }]
    await testDb.insert(lessons).values(
      await lessonRow('protect-your-data', 'safety', 'advanced', {
        bodyMd: '## Your rights\n\nYou can ask to see your data.',
        imageUrl: '/api/v1/media/lesson.png',
        videoUrl: 'https://www.youtube.com/watch?v=abc',
        resources,
      }),
    )
    const res = await get('/api/v1/lessons/protect-your-data')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      slug: 'protect-your-data',
      area: 'safety',
      tier: 'advanced',
      title: 'Title of protect-your-data',
      summary: 'Summary of protect-your-data',
      bodyMd: '## Your rights\n\nYou can ask to see your data.',
      imageUrl: '/api/v1/media/lesson.png',
      videoUrl: 'https://www.youtube.com/watch?v=abc',
      resources,
      updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    })
  })

  it('answers 404 for a draft or a slug that doesn’t exist', async () => {
    await testDb
      .insert(lessons)
      .values(await lessonRow('draft', 'safety', 'foundations', { isPublished: false }))
    for (const slug of ['draft', 'nope']) {
      const res = await get(`/api/v1/lessons/${slug}`)
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({
        error: { code: 'not_found', message: expect.any(String) },
      })
    }
  })

  it('answers 400 for something that isn’t a slug', async () => {
    const res = await get('/api/v1/lessons/Not%20A%20Slug')
    expect(res.status).toBe(400)
  })
})
