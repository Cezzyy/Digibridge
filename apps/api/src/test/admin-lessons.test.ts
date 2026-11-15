import { lessons } from '@digibridge/db'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { clearQuestionBank, signedIn, testDb } from './helpers'
import { get, send, useQuestionBank, lessonRow } from './fixtures'

useQuestionBank()

describe('admin lessons editor (CMS-04)', () => {
  const input = {
    area: 'safety',
    tier: 'foundations',
    slug: 'spot-scams',
    title: ' Spot scams ',
    summary: 'Tell a scam from a real message.',
    bodyMd: '## What you’ll learn\n\n- One thing',
    imageUrl: 'https://example.com/scam.png',
    videoUrl: null,
    resources: [{ label: 'NPC', url: 'https://privacy.gov.ph' }],
    isPublished: false,
  }

  const insertLesson = async (...args: Parameters<typeof lessonRow>) => {
    const [row] = await testDb
      .insert(lessons)
      .values(await lessonRow(...args))
      .returning({ id: lessons.id })
    return row!.id
  }

  const published = async () =>
    (
      await testDb
        .select({ slug: lessons.slug })
        .from(lessons)
        .where(eq(lessons.isPublished, true))
        .orderBy(lessons.slug)
    ).map((l) => l.slug)

  describe('GET /api/v1/admin/lessons', () => {
    it('lists every lesson, drafts too, with the published one first in each tier', async () => {
      await insertLesson('safety-draft', 'safety', 'foundations', { isPublished: false })
      await insertLesson('safety-live', 'safety', 'foundations')
      await insertLesson('info-draft', 'info_literacy', 'advanced', { isPublished: false })

      const admin = await signedIn('admin')
      const res = await get('/api/v1/admin/lessons', admin.headers)
      expect(res.status).toBe(200)
      const { lessons: list } = (await res.json()) as { lessons: Record<string, unknown>[] }
      expect(list.map((l) => l.slug)).toEqual(['info-draft', 'safety-live', 'safety-draft'])
      expect(list[0]).toEqual({
        id: expect.any(String),
        slug: 'info-draft',
        area: 'info_literacy',
        tier: 'advanced',
        title: 'Title of info-draft',
        summary: 'Summary of info-draft',
        isPublished: false,
        updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      })
    })

    it('refuses facilitators', async () => {
      const staff = await signedIn('facilitator')
      expect((await get('/api/v1/admin/lessons', staff.headers)).status).toBe(403)
    })
  })

  describe('GET /api/v1/admin/lessons/:id', () => {
    it('sends a whole draft', async () => {
      const id = await insertLesson('a-draft', 'communication', 'intermediate', {
        isPublished: false,
        videoUrl: 'https://www.youtube.com/watch?v=abc',
      })
      const admin = await signedIn('admin')
      const res = await get(`/api/v1/admin/lessons/${id}`, admin.headers)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        id,
        slug: 'a-draft',
        area: 'communication',
        tier: 'intermediate',
        title: 'Title of a-draft',
        summary: 'Summary of a-draft',
        bodyMd: '## a-draft',
        imageUrl: null,
        videoUrl: 'https://www.youtube.com/watch?v=abc',
        resources: [],
        isPublished: false,
        updatedAt: expect.any(String),
      })
    })

    it('answers 404 for a lesson that isn’t there', async () => {
      const admin = await signedIn('admin')
      const res = await get(`/api/v1/admin/lessons/${crypto.randomUUID()}`, admin.headers)
      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/v1/admin/lessons', () => {
    it('adds a draft and sends it back with nothing extra', async () => {
      const admin = await signedIn('admin')
      const res = await send('POST', '/api/v1/admin/lessons', admin.headers, input)
      expect(res.status).toBe(201)
      expect(await res.json()).toEqual({
        ...input,
        title: 'Spot scams',
        id: expect.any(String),
        updatedAt: expect.any(String),
      })
      expect(await published()).toEqual([])
    })

    it('publishing takes the place of the lesson published for that area and tier', async () => {
      await insertLesson('old-scams', 'safety', 'foundations')
      await insertLesson('other-tier', 'safety', 'intermediate')
      const admin = await signedIn('admin')
      const res = await send('POST', '/api/v1/admin/lessons', admin.headers, {
        ...input,
        isPublished: true,
      })
      expect(res.status).toBe(201)
      expect(await published()).toEqual(['other-tier', 'spot-scams'])
    })

    it('answers 409 when another lesson holds the place than `replaces` says, and keeps it', async () => {
      const oldId = await insertLesson('old-scams', 'safety', 'foundations')
      const admin = await signedIn('admin')
      for (const replaces of [null, crypto.randomUUID()]) {
        const stale = await send('POST', '/api/v1/admin/lessons', admin.headers, {
          ...input,
          isPublished: true,
          replaces,
        })
        expect(stale.status).toBe(409)
        expect(await published()).toEqual(['old-scams'])
      }
      const agreed = await send('POST', '/api/v1/admin/lessons', admin.headers, {
        ...input,
        isPublished: true,
        replaces: oldId,
      })
      expect(agreed.status).toBe(201)
      expect(await published()).toEqual(['spot-scams'])
    })

    it('answers 404 when the areas were never seeded', async () => {
      await clearQuestionBank()
      const admin = await signedIn('admin')
      const res = await send('POST', '/api/v1/admin/lessons', admin.headers, input)
      expect(res.status).toBe(404)
      expect(await testDb.select().from(lessons)).toEqual([])
    })

    it('answers 409 for a slug in use and 400 for a bad field', async () => {
      await insertLesson('spot-scams', 'info_literacy', 'advanced', { isPublished: false })
      const admin = await signedIn('admin')
      const taken = await send('POST', '/api/v1/admin/lessons', admin.headers, input)
      expect(taken.status).toBe(409)
      expect(await taken.json()).toEqual({
        error: { code: 'conflict', message: expect.stringContaining('slug') },
      })
      for (const bad of [
        { slug: 'Not A Slug' },
        { title: ' ' },
        { videoUrl: 'ftp://a.ph' },
        { imageUrl: 'http://example.com/a.png' },
        { replaces: 'not-an-id' },
      ]) {
        const res = await send('POST', '/api/v1/admin/lessons', admin.headers, {
          ...input,
          slug: 'fresh',
          ...bad,
        })
        expect(res.status).toBe(400)
      }
    })

    it('refuses facilitators', async () => {
      const staff = await signedIn('facilitator')
      const res = await send('POST', '/api/v1/admin/lessons', staff.headers, input)
      expect(res.status).toBe(403)
      expect(await testDb.select().from(lessons)).toEqual([])
    })
  })

  describe('PATCH /api/v1/admin/lessons/:id', () => {
    it('changes only the fields sent', async () => {
      const id = await insertLesson('a-draft', 'safety', 'foundations', { isPublished: false })
      const admin = await signedIn('admin')
      const res = await send('PATCH', `/api/v1/admin/lessons/${id}`, admin.headers, {
        title: 'New title',
        resources: input.resources,
      })
      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({
        id,
        slug: 'a-draft',
        area: 'safety',
        title: 'New title',
        summary: 'Summary of a-draft',
        resources: input.resources,
        isPublished: false,
      })
    })

    it('publishing a draft unpublishes the lesson it replaces', async () => {
      await insertLesson('old', 'safety', 'foundations')
      const id = await insertLesson('new', 'safety', 'foundations', { isPublished: false })
      const admin = await signedIn('admin')
      const res = await send('PATCH', `/api/v1/admin/lessons/${id}`, admin.headers, {
        isPublished: true,
      })
      expect(res.status).toBe(200)
      expect(await published()).toEqual(['new'])
    })

    it('answers 409 when publishing would unpublish a lesson `replaces` doesn’t name', async () => {
      await insertLesson('theirs', 'safety', 'foundations')
      const id = await insertLesson('mine', 'safety', 'foundations', { isPublished: false })
      const admin = await signedIn('admin')
      const res = await send('PATCH', `/api/v1/admin/lessons/${id}`, admin.headers, {
        isPublished: true,
        replaces: null,
      })
      expect(res.status).toBe(409)
      expect(await published()).toEqual(['theirs'])
      // Saving a published lesson where it is, with nothing else there, replaces nothing.
      const live = await insertLesson('live', 'safety', 'advanced')
      const kept = await send('PATCH', `/api/v1/admin/lessons/${live}`, admin.headers, {
        title: 'Renamed',
        replaces: null,
      })
      expect(kept.status).toBe(200)
      expect(await published()).toEqual(['live', 'theirs'])
    })

    it('a published lesson moved to another area and tier takes that one’s place', async () => {
      await insertLesson('info-live', 'info_literacy', 'advanced')
      const id = await insertLesson('moving', 'safety', 'foundations')
      const admin = await signedIn('admin')
      const res = await send('PATCH', `/api/v1/admin/lessons/${id}`, admin.headers, {
        area: 'info_literacy',
        tier: 'advanced',
      })
      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ area: 'info_literacy', tier: 'advanced' })
      expect(await published()).toEqual(['moving'])
    })

    it('unpublishing leaves the area and tier empty', async () => {
      const id = await insertLesson('live', 'safety', 'foundations')
      const admin = await signedIn('admin')
      const res = await send('PATCH', `/api/v1/admin/lessons/${id}`, admin.headers, {
        isPublished: false,
      })
      expect(res.status).toBe(200)
      expect(await published()).toEqual([])
    })

    it('answers 409 for a slug in use and 404 for a lesson that isn’t there', async () => {
      await insertLesson('taken', 'safety', 'advanced')
      const id = await insertLesson('mine', 'safety', 'foundations')
      const admin = await signedIn('admin')
      const taken = await send('PATCH', `/api/v1/admin/lessons/${id}`, admin.headers, {
        slug: 'taken',
      })
      expect(taken.status).toBe(409)
      const missing = await send(
        'PATCH',
        `/api/v1/admin/lessons/${crypto.randomUUID()}`,
        admin.headers,
        { title: 'x' },
      )
      expect(missing.status).toBe(404)
    })

    it('refuses facilitators', async () => {
      const id = await insertLesson('mine', 'safety', 'foundations')
      const staff = await signedIn('facilitator')
      const res = await send('PATCH', `/api/v1/admin/lessons/${id}`, staff.headers, {
        isPublished: false,
      })
      expect(res.status).toBe(403)
      expect(await published()).toEqual(['mine'])
    })
  })

  describe('DELETE /api/v1/admin/lessons/:id', () => {
    it('deletes a draft', async () => {
      const id = await insertLesson('a-draft', 'safety', 'foundations', { isPublished: false })
      const admin = await signedIn('admin')
      const res = await send('DELETE', `/api/v1/admin/lessons/${id}`, admin.headers)
      expect(res.status).toBe(204)
      expect(await testDb.select().from(lessons)).toEqual([])
    })

    it('keeps a published lesson (409) and answers 404 for one that isn’t there', async () => {
      const id = await insertLesson('live', 'safety', 'foundations')
      const admin = await signedIn('admin')
      const live = await send('DELETE', `/api/v1/admin/lessons/${id}`, admin.headers)
      expect(live.status).toBe(409)
      expect(await published()).toEqual(['live'])
      const missing = await send(
        'DELETE',
        `/api/v1/admin/lessons/${crypto.randomUUID()}`,
        admin.headers,
      )
      expect(missing.status).toBe(404)
    })

    it('refuses facilitators', async () => {
      const id = await insertLesson('a-draft', 'safety', 'foundations', { isPublished: false })
      const staff = await signedIn('facilitator')
      expect((await send('DELETE', `/api/v1/admin/lessons/${id}`, staff.headers)).status).toBe(403)
    })
  })
})
