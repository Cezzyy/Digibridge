import {
  attemptStatusSchema,
  courseSchema,
  schoolRespondentSchema,
  yearLevelSchema,
} from '@digibridge/shared'
import { createRoute, z } from '@hono/zod-openapi'
import { errorResponse } from '../openapi'
import { RespondentSummarySchema } from './respondents'

// The school-link routes a student calls without signing in (LNK-02, LNK-03). An admin makes the
// link (routes/admin.ts); the student opens /s/<code> on the web app.

const LinkParamsSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(64)
    .openapi({
      param: { name: 'code', in: 'path' },
      description: 'The code in the link’s address',
    }),
})

// No sign-in; a student who already joined sends their respondent token.
const OPTIONAL_TOKEN: Record<string, string[]>[] = [{}, { RespondentToken: [] }]

/** A link as its students see it, and their own place in it once they joined. */
export const OpenSchoolLinkSchema = z
  .object({
    code: z.string(),
    school: z.string(),
    label: z.string(),
    // The course and year level the link is for; null lets in any. The profile form fixes them.
    course: courseSchema.nullable(),
    yearLevel: yearLevelSchema.nullable(),
    // Only with a respondent token for this link: the student and their attempt (null until
    // started, and when voided), as GET /me gives them online.
    respondent: RespondentSummarySchema.nullable(),
    attempt: z.object({ id: z.uuid(), status: attemptStatusSchema }).nullable(),
  })
  .openapi('OpenSchoolLink')

export const getLinkRoute = createRoute({
  method: 'get',
  path: '/links/{code}',
  tags: ['School link'],
  summary: 'Open a school link',
  description:
    'No sign-in. Gives the link’s name and its course and year-level lock while it’s open (LNK-02). With the `X-Respondent-Token` of a student who joined through it, it also gives their respondent and attempt, even after the link closed, so they can finish (LNK-04).',
  security: OPTIONAL_TOKEN,
  request: { params: LinkParamsSchema },
  responses: {
    200: {
      description: 'The link',
      content: { 'application/json': { schema: OpenSchoolLinkSchema } },
    },
    401: errorResponse('The respondent token isn’t one for this link'),
    404: errorResponse('No link has this code'),
    410: errorResponse('The link was closed, has expired or is full'),
  },
})

export const JoinedSchoolLinkSchema = z
  .object({
    respondent: RespondentSummarySchema,
    // Sent this once only: the database keeps its hash. The browser sends it back as
    // `X-Respondent-Token` on the respondent routes.
    token: z.string(),
  })
  .openapi('JoinedSchoolLink')

export const joinLinkRoute = createRoute({
  method: 'post',
  path: '/links/{code}/respondents',
  tags: ['School link'],
  summary: 'Save consent, the school profile and identity choice',
  description:
    'No sign-in. The general profile plus student number, course and year level, which must fit the link’s lock, the identity choice and consent to the school notice, saved together (LNK-03, PRO-01 to PRO-05, CON-02). The student counts against the link’s limit from now on, and can take the assessment even if the link closes later. One respondent per student number across all links. A student whose every attempt was voided (USR-03) can join again with the same number, through this link or another: their profile and consent are saved again in place, the token changes, and they count against this link. Returns the respondent token once.',
  request: {
    params: LinkParamsSchema,
    body: {
      required: true,
      content: {
        // .meta, not .openapi: shared schemas are built before @hono/zod-openapi adds .openapi.
        'application/json': { schema: schoolRespondentSchema.meta({ id: 'NewSchoolRespondent' }) },
      },
    },
  },
  responses: {
    201: {
      description: 'The student joined',
      content: { 'application/json': { schema: JoinedSchoolLinkSchema } },
    },
    400: errorResponse(
      'A field is missing or not valid, it doesn’t fit the link’s course or year level, or the notice is out of date',
    ),
    404: errorResponse('No link has this code'),
    409: errorResponse(
      'The student number was already used, by a student who hasn’t had every attempt voided',
    ),
    410: errorResponse('The link was closed, has expired or is full'),
  },
})
