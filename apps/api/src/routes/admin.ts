import { linkStatusSchema, schoolLinkSchema, STAFF_ROLES } from '@digibridge/shared'
import { createRoute, z } from '@hono/zod-openapi'
import { auth, requireRole } from '../middleware'
import { errorResponse } from '../openapi'

export const SIGNED_IN_ERRORS = {
  401: errorResponse('Not signed in, or the sign-in has expired'),
}

/** The 401 and 403 of a route for staff (admins and facilitators). */
export const STAFF_ERRORS = {
  ...SIGNED_IN_ERRORS,
  403: errorResponse('Signed in as a respondent'),
}

/** The 401 and 403 of a route for admins only. */
export const ADMIN_ERRORS = { ...SIGNED_IN_ERRORS, 403: errorResponse('Not an admin') }

/** Counts for the admin overview page. Voided attempts count nowhere. */
const OverviewSchema = z
  .object({
    respondents: z.object({ total: z.int(), online: z.int(), school: z.int() }),
    attempts: z.object({
      inProgress: z.int(),
      // Submitted or expired: both have results.
      finished: z.int(),
    }),
    links: z.object({ open: z.int(), total: z.int() }),
  })
  .openapi('AdminOverview')

export const overviewRoute = createRoute({
  method: 'get',
  path: '/admin/overview',
  tags: ['Admin'],
  summary: 'Counts for the overview page',
  description: 'Respondents by mode, attempts in progress and finished, and school links. Staff.',
  middleware: [auth, requireRole(...STAFF_ROLES)] as const,
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: 'The counts',
      content: { 'application/json': { schema: OverviewSchema } },
    },
    ...STAFF_ERRORS,
  },
})

/** A school link as the links page shows it (LNK-01). */
export const SchoolLinkSchema = z
  .object({
    id: z.uuid(),
    // The link students open is /s/<code> on the web app.
    code: z.string(),
    school: z.string(),
    label: z.string(),
    // Null for any course, any year level, and no limit.
    course: z.string().nullable(),
    yearLevel: z.int().nullable(),
    maxResponses: z.int().nullable(),
    expiresAt: z.iso.datetime(),
    closedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    // The admin's name, or their email if Google gave no name; null once their account is gone.
    createdBy: z.string().nullable(),
    // Students who saved their profile through the link (LNK-02).
    responses: z.int(),
    status: linkStatusSchema,
  })
  .openapi('SchoolLink')

export const listLinksRoute = createRoute({
  method: 'get',
  path: '/admin/links',
  tags: ['Admin'],
  summary: 'List school links, newest first',
  description: 'Each with its response count and status: open, closed, expired or full (LNK-01).',
  middleware: [auth, requireRole('admin')] as const,
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: 'Every school link',
      content: { 'application/json': { schema: z.array(SchoolLinkSchema) } },
    },
    ...ADMIN_ERRORS,
  },
})

export const createLinkRoute = createRoute({
  method: 'post',
  path: '/admin/links',
  tags: ['Admin'],
  summary: 'Make a school link',
  description:
    'With the school, a label, the last day it stays open (it closes at midnight after it, Philippine time) and an optional course, year level and response limit (LNK-01).',
  middleware: [auth, requireRole('admin')] as const,
  security: [{ Bearer: [] }],
  request: {
    body: {
      required: true,
      content: {
        // .meta, not .openapi: shared schemas are built before @hono/zod-openapi adds .openapi.
        'application/json': { schema: schoolLinkSchema.meta({ id: 'NewSchoolLink' }) },
      },
    },
  },
  responses: {
    201: {
      description: 'The new link',
      content: { 'application/json': { schema: SchoolLinkSchema } },
    },
    400: errorResponse('A field is missing or not valid'),
    ...ADMIN_ERRORS,
  },
})

const LinkParamsSchema = z.object({
  id: z.uuid().openapi({ param: { name: 'id', in: 'path' }, description: 'The link' }),
})

export const closeLinkRoute = createRoute({
  method: 'post',
  path: '/admin/links/{id}/close',
  tags: ['Admin'],
  summary: 'Close a school link',
  description:
    'New students can’t start from it any more; attempts already started can still finish. Closing a closed or expired link changes nothing (LNK-01).',
  middleware: [auth, requireRole('admin')] as const,
  security: [{ Bearer: [] }],
  request: { params: LinkParamsSchema },
  responses: {
    200: {
      description: 'The closed link',
      content: { 'application/json': { schema: SchoolLinkSchema } },
    },
    400: errorResponse('The ID is not valid'),
    ...ADMIN_ERRORS,
    404: errorResponse('No link with this ID'),
  },
})
