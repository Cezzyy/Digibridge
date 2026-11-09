import {
  areaCodeSchema,
  lessonResourceSchema,
  lessonSlugSchema,
  lessonTierSchema,
} from '@digibridge/shared'
import { createRoute, z } from '@hono/zod-openapi'
import { errorResponse } from '../openapi'

// The lessons library (LES-01 to LES-03). Public: no sign-in, and only published lessons.

/** A lesson as the library lists it. */
export const LessonSummarySchema = z
  .object({
    slug: z.string(),
    area: areaCodeSchema,
    tier: lessonTierSchema,
    title: z.string(),
    summary: z.string(),
  })
  .openapi('LessonSummary')

const LessonListQuerySchema = z.object({
  area: areaCodeSchema.optional(),
  tier: lessonTierSchema.optional(),
})

export const listLessonsRoute = createRoute({
  method: 'get',
  path: '/lessons',
  tags: ['Lessons'],
  summary: 'The published lessons',
  description:
    'Every published lesson, in the areas’ order, then Foundations, Intermediate and Advanced (LES-01). Filter by `area`, `tier` or both. Open to everyone, signed in or not (LES-03).',
  request: { query: LessonListQuerySchema },
  responses: {
    200: {
      description: 'The lessons',
      content: {
        'application/json': {
          schema: z.object({ lessons: z.array(LessonSummarySchema) }).openapi('LessonList'),
        },
      },
    },
    400: errorResponse('An unknown area or tier'),
  },
})

/** A whole lesson, as its page shows it (LES-02). */
export const LessonSchema = LessonSummarySchema.extend({
  // Markdown. The web app renders it and cleans the HTML before showing it.
  bodyMd: z.string(),
  imageUrl: z.string().nullable(),
  videoUrl: z.string().nullable(),
  resources: z.array(lessonResourceSchema),
  updatedAt: z.iso.datetime(),
}).openapi('Lesson')

const LessonParamsSchema = z.object({ slug: lessonSlugSchema })

export const getLessonRoute = createRoute({
  method: 'get',
  path: '/lessons/{slug}',
  tags: ['Lessons'],
  summary: 'One published lesson',
  description:
    'The lesson’s title, area, tier, Markdown body, image, video link and outside resources (LES-02). A draft answers 404, like a slug that doesn’t exist. Open to everyone (LES-03).',
  request: { params: LessonParamsSchema },
  responses: {
    200: {
      description: 'The lesson',
      content: { 'application/json': { schema: LessonSchema } },
    },
    400: errorResponse('Not a lesson slug'),
    404: errorResponse('No published lesson with this slug'),
  },
})
