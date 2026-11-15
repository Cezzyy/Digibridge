import { lessonInputSchema } from '@digibridge/shared'
import { createRoute, z } from '@hono/zod-openapi'
import { auth, requireRole } from '../middleware'
import { errorResponse } from '../openapi'
import { SIGNED_IN_ERRORS } from './admin'
import { LessonSchema, LessonSummarySchema } from './lessons'

// The lessons editor (CMS-04). Admin only. Unlike the public library, it sees drafts too.

/** A lesson as the editor's list shows it, drafts included. */
const AdminLessonSummarySchema = LessonSummarySchema.extend({
  id: z.uuid(),
  isPublished: z.boolean(),
  updatedAt: z.iso.datetime(),
}).openapi('AdminLessonSummary')

/** A whole lesson, as the editor loads and saves it. */
export const AdminLessonSchema = LessonSchema.extend({
  id: z.uuid(),
  isPublished: z.boolean(),
}).openapi('AdminLesson')

const LessonIdParamsSchema = z.object({
  id: z.uuid().openapi({ param: { name: 'id', in: 'path' }, description: 'The lesson' }),
})

const lessonBody = <T extends z.ZodType>(schema: T, id: string) => ({
  body: {
    required: true,
    // .meta, not .openapi: shared schemas are built before @hono/zod-openapi adds .openapi.
    content: { 'application/json': { schema: schema.meta({ id }) } },
  },
})

const ADMIN_ERRORS = { ...SIGNED_IN_ERRORS, 403: errorResponse('Not an admin') }

const PUBLISH_NOTE =
  'Only one lesson per area and tier is published at a time (LES-01): publishing this one unpublishes the one before, in the same transaction.'

export const listAdminLessonsRoute = createRoute({
  method: 'get',
  path: '/admin/lessons',
  tags: ['Admin'],
  summary: 'Every lesson, drafts included',
  description:
    'By area order, then tier; in each tier the published lesson first, then drafts, newest edit first (CMS-04).',
  middleware: [auth, requireRole('admin')] as const,
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: 'The lessons',
      content: {
        'application/json': {
          schema: z
            .object({ lessons: z.array(AdminLessonSummarySchema) })
            .openapi('AdminLessonList'),
        },
      },
    },
    ...ADMIN_ERRORS,
  },
})

export const getAdminLessonRoute = createRoute({
  method: 'get',
  path: '/admin/lessons/{id}',
  tags: ['Admin'],
  summary: 'One lesson, draft or published',
  description: 'Everything the editor shows (CMS-04).',
  middleware: [auth, requireRole('admin')] as const,
  security: [{ Bearer: [] }],
  request: { params: LessonIdParamsSchema },
  responses: {
    200: {
      description: 'The lesson',
      content: { 'application/json': { schema: AdminLessonSchema } },
    },
    400: errorResponse('The ID is not valid'),
    ...ADMIN_ERRORS,
    404: errorResponse('No lesson with this ID'),
  },
})

export const createLessonRoute = createRoute({
  method: 'post',
  path: '/admin/lessons',
  tags: ['Admin'],
  summary: 'Add a lesson',
  description: `With its area, tier, slug, title, summary, Markdown body, optional image and video links, and outside resources (CMS-04, LES-02). ${PUBLISH_NOTE}`,
  middleware: [auth, requireRole('admin')] as const,
  security: [{ Bearer: [] }],
  request: lessonBody(lessonInputSchema, 'NewLesson'),
  responses: {
    201: {
      description: 'The new lesson',
      content: { 'application/json': { schema: AdminLessonSchema } },
    },
    400: errorResponse('A field is missing or not valid'),
    ...ADMIN_ERRORS,
    409: errorResponse('The slug is taken, or another lesson was published in its place just now'),
  },
})

export const updateLessonRoute = createRoute({
  method: 'patch',
  path: '/admin/lessons/{id}',
  tags: ['Admin'],
  summary: 'Edit a lesson',
  description: `Any of the fields a new lesson takes; the rest stay as they are (CMS-04). ${PUBLISH_NOTE} Unpublishing leaves its area and tier with no lesson until another is published.`,
  middleware: [auth, requireRole('admin')] as const,
  security: [{ Bearer: [] }],
  request: {
    params: LessonIdParamsSchema,
    ...lessonBody(lessonInputSchema.partial(), 'LessonChanges'),
  },
  responses: {
    200: {
      description: 'The lesson as saved',
      content: { 'application/json': { schema: AdminLessonSchema } },
    },
    400: errorResponse('A field or the ID is not valid'),
    ...ADMIN_ERRORS,
    404: errorResponse('No lesson with this ID'),
    409: errorResponse('The slug is taken, or another lesson was published in its place just now'),
  },
})

export const deleteLessonRoute = createRoute({
  method: 'delete',
  path: '/admin/lessons/{id}',
  tags: ['Admin'],
  summary: 'Delete a draft',
  description:
    'Only drafts can be deleted, so a lesson students can open never just disappears: unpublish it first (CMS-04).',
  middleware: [auth, requireRole('admin')] as const,
  security: [{ Bearer: [] }],
  request: { params: LessonIdParamsSchema },
  responses: {
    204: { description: 'Deleted' },
    400: errorResponse('The ID is not valid'),
    ...ADMIN_ERRORS,
    404: errorResponse('No lesson with this ID'),
    409: errorResponse('The lesson is published'),
  },
})
