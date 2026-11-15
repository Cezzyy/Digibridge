import { competencyAreas, lessons } from '@digibridge/db'
import type { AreaCode, LessonTier } from '@digibridge/shared'
import type { RouteHandler } from '@hono/zod-openapi'
import { and, asc, desc, eq, ne, type SQL } from 'drizzle-orm'
import type { Db } from '../config/db'
import type { AuthEnv } from '../env'
import { areaIdOf, toEditorJson } from '../lib/area-id'
import type { Tx } from '../lib/close-attempt'
import { notNullViolation, uniqueViolation } from '../lib/pg-errors'
import { ApiError } from '../middleware'
import type {
  createLessonRoute,
  deleteLessonRoute,
  getAdminLessonRoute,
  listAdminLessonsRoute,
  updateLessonRoute,
} from '../routes/admin-lessons'

// The lessons editor (CMS-04). Admin only; drafts included.

const NOT_FOUND = 'We couldn’t find this lesson. Someone may have deleted it.'

/** What a save returns: every field the editor shows but the area, which is on another table. */
const savedColumns = {
  id: lessons.id,
  slug: lessons.slug,
  tier: lessons.tier,
  title: lessons.title,
  summary: lessons.summary,
  bodyMd: lessons.bodyMd,
  imageUrl: lessons.imageUrl,
  videoUrl: lessons.videoUrl,
  resources: lessons.resources,
  isPublished: lessons.isPublished,
  updatedAt: lessons.updatedAt,
}

const lessonColumns = { ...savedColumns, area: competencyAreas.code }

/**
 * Unpublishes whatever is published for this area and tier, other than `keep`, so the lesson
 * being saved can take its place (LES-01: one published lesson per area and tier). `replaces`,
 * when the editor sends it, is the lesson the admin agreed to replace (null for none): anything
 * else there means another admin published since the editor looked, so it's a 409 and the
 * transaction rolls back.
 */
async function clearSlot(
  tx: Tx,
  place: { areaId: string | SQL<string>; tier: LessonTier },
  replaces: string | null | undefined,
  keep?: string,
) {
  const cleared = await tx
    .update(lessons)
    .set({ isPublished: false })
    .where(
      and(
        eq(lessons.areaId, place.areaId),
        eq(lessons.tier, place.tier),
        eq(lessons.isPublished, true),
        keep ? ne(lessons.id, keep) : undefined,
      ),
    )
    .returning({ id: lessons.id })
  if (replaces !== undefined && (cleared[0]?.id ?? null) !== replaces) {
    throw new ApiError(
      'conflict',
      'Another lesson was published for this area and level since you opened this page. Check which one is there now, then publish again.',
    )
  }
}

/**
 * Saves `save` and turns the errors it can hit into answers: a slug in use, or another admin
 * publishing for the same area and tier at the same moment (the second one waits on the first's
 * index entry, then fails once it commits), are 409s; an area that was never seeded is a 404.
 */
async function saving<T>(save: () => Promise<T>): Promise<T> {
  try {
    return await save()
  } catch (err) {
    const constraint = uniqueViolation(err)
    if (constraint === 'lessons_slug_unique') {
      throw new ApiError('conflict', 'Another lesson already uses this slug. Pick a different one.')
    }
    if (constraint === 'lessons_one_published_per_tier_idx') {
      throw new ApiError(
        'conflict',
        'Another lesson was just published for this area and level. Reload and try again.',
      )
    }
    if (notNullViolation(err) === 'area_id') {
      throw new ApiError('not_found', 'This area isn’t set up yet.')
    }
    throw err
  }
}

async function selectLesson(db: Db, id: string) {
  const [lesson] = await db
    .select(lessonColumns)
    .from(lessons)
    .innerJoin(competencyAreas, eq(competencyAreas.id, lessons.areaId))
    .where(eq(lessons.id, id))
  if (!lesson) throw new ApiError('not_found', NOT_FOUND)
  return lesson
}

export const listAdminLessons: RouteHandler<typeof listAdminLessonsRoute, AuthEnv> = async (c) => {
  const rows = await c.var.db
    .select({
      id: lessons.id,
      slug: lessons.slug,
      area: competencyAreas.code,
      tier: lessons.tier,
      title: lessons.title,
      summary: lessons.summary,
      isPublished: lessons.isPublished,
      updatedAt: lessons.updatedAt,
    })
    .from(lessons)
    .innerJoin(competencyAreas, eq(competencyAreas.id, lessons.areaId))
    // Tiers sort in the enum's order: foundations, intermediate, advanced.
    .orderBy(
      asc(competencyAreas.sortOrder),
      asc(lessons.tier),
      desc(lessons.isPublished),
      desc(lessons.updatedAt),
    )
  return c.json({ lessons: rows.map(toEditorJson) }, 200)
}

export const getAdminLesson: RouteHandler<typeof getAdminLessonRoute, AuthEnv> = async (c) =>
  c.json(toEditorJson(await selectLesson(c.var.db, c.req.valid('param').id)), 200)

export const createLesson: RouteHandler<typeof createLessonRoute, AuthEnv> = async (c) => {
  const { area, replaces, ...lesson } = c.req.valid('json')
  const created = await saving(() =>
    c.var.db.transaction(async (tx) => {
      const areaId = areaIdOf(area)
      if (lesson.isPublished) await clearSlot(tx, { areaId, tier: lesson.tier }, replaces)
      const [row] = await tx
        .insert(lessons)
        .values({ ...lesson, areaId })
        .returning(savedColumns)
      return row!
    }),
  )
  return c.json(toEditorJson({ ...created, area }), 201)
}

export const updateLesson: RouteHandler<typeof updateLessonRoute, AuthEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const { area: newArea, replaces, ...changes } = c.req.valid('json')

  const updated = await saving(() =>
    c.var.db.transaction(async (tx) => {
      // Locked, so a delete or another edit of this lesson waits for this one.
      const [current] = await tx
        .select({
          areaId: lessons.areaId,
          area: competencyAreas.code,
          tier: lessons.tier,
          isPublished: lessons.isPublished,
        })
        .from(lessons)
        .innerJoin(competencyAreas, eq(competencyAreas.id, lessons.areaId))
        .where(eq(lessons.id, id))
        .for('update', { of: lessons })
      if (!current) throw new ApiError('not_found', NOT_FOUND)

      const area = newArea ?? (current.area as AreaCode)
      const areaId = area === current.area ? current.areaId : areaIdOf(area)
      // A lesson moved to another area or tier while published takes that one's place too.
      if (changes.isPublished ?? current.isPublished) {
        await clearSlot(tx, { areaId, tier: changes.tier ?? current.tier }, replaces, id)
      }
      const [row] = await tx
        .update(lessons)
        // areaId is always set, so even an empty change bumps updatedAt.
        .set({ ...changes, areaId })
        .where(eq(lessons.id, id))
        .returning(savedColumns)
      return { ...row!, area }
    }),
  )
  return c.json(toEditorJson(updated), 200)
}

export const deleteLesson: RouteHandler<typeof deleteLessonRoute, AuthEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const db = c.var.db
  const [deleted] = await db
    .delete(lessons)
    .where(and(eq(lessons.id, id), eq(lessons.isPublished, false)))
    .returning({ id: lessons.id })
  if (deleted) return c.body(null, 204)

  // Nothing deleted: either it's published or it isn't there.
  const [lesson] = await db.select({ id: lessons.id }).from(lessons).where(eq(lessons.id, id))
  if (!lesson) throw new ApiError('not_found', NOT_FOUND)
  throw new ApiError('conflict', 'Unpublish this lesson before you delete it.')
}
