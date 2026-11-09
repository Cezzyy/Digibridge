import { competencyAreas, lessons } from '@digibridge/db'
import type { AreaCode } from '@digibridge/shared'
import type { RouteHandler } from '@hono/zod-openapi'
import { and, asc, eq } from 'drizzle-orm'
import type { AppEnv } from '../env'
import { ApiError } from '../middleware'
import type { getLessonRoute, listLessonsRoute } from '../routes/lessons'

const summaryColumns = {
  slug: lessons.slug,
  area: competencyAreas.code,
  tier: lessons.tier,
  title: lessons.title,
  summary: lessons.summary,
}

// Area codes are the seeded AREA_CODES.
const withArea = <T extends { area: string }>(row: T) => ({ ...row, area: row.area as AreaCode })

export const listLessons: RouteHandler<typeof listLessonsRoute, AppEnv> = async (c) => {
  const { area, tier } = c.req.valid('query')
  const rows = await c.var.db
    .select(summaryColumns)
    .from(lessons)
    .innerJoin(competencyAreas, eq(competencyAreas.id, lessons.areaId))
    .where(
      and(
        eq(lessons.isPublished, true),
        area ? eq(competencyAreas.code, area) : undefined,
        tier ? eq(lessons.tier, tier) : undefined,
      ),
    )
    // Tiers sort in the enum's order: foundations, intermediate, advanced.
    .orderBy(
      asc(competencyAreas.sortOrder),
      asc(lessons.tier),
      asc(lessons.sortOrder),
      asc(lessons.title),
    )
  return c.json({ lessons: rows.map(withArea) }, 200)
}

export const getLesson: RouteHandler<typeof getLessonRoute, AppEnv> = async (c) => {
  const { slug } = c.req.valid('param')
  const [lesson] = await c.var.db
    .select({
      ...summaryColumns,
      bodyMd: lessons.bodyMd,
      imageUrl: lessons.imageUrl,
      videoUrl: lessons.videoUrl,
      resources: lessons.resources,
      updatedAt: lessons.updatedAt,
    })
    .from(lessons)
    .innerJoin(competencyAreas, eq(competencyAreas.id, lessons.areaId))
    .where(and(eq(lessons.slug, slug), eq(lessons.isPublished, true)))
  // A draft isn't out yet, so it looks the same as no lesson at all.
  if (!lesson) throw new ApiError('not_found', 'We couldn’t find this lesson.')
  return c.json({ ...withArea(lesson), updatedAt: lesson.updatedAt.toISOString() }, 200)
}
