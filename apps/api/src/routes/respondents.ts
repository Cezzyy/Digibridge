import { onlineRespondentSchema } from '@digibridge/shared'
import { createRoute, z } from '@hono/zod-openapi'
import { accountActionLimit, auth, requireRole } from '../middleware'
import { errorResponse, rateLimited } from '../openapi'

/** A respondent as their own pages see them. Also used by GET /me. */
export const RespondentSummarySchema = z
  .object({ id: z.uuid(), fullName: z.string() })
  .openapi('RespondentSummary')

export const createRespondentRoute = createRoute({
  method: 'post',
  path: '/respondents',
  tags: ['Respondent'],
  summary: 'Save consent, profile and identity choice',
  description:
    'Online: the general profile only (PRO-01, PRO-06). Consent is saved with the profile, so declining stores nothing (CON-02). One respondent per Google account (PRO-07). Respondents only: staff try the flow as a preview that saves nothing, so no test rows reach the research data.',
  // School-link students save theirs through the link: POST /links/{code}/respondents.
  middleware: [auth, requireRole('respondent'), accountActionLimit('respondent')] as const,
  security: [{ Bearer: [] }],
  request: {
    body: {
      required: true,
      content: {
        // .meta, not .openapi: shared schemas are built before @hono/zod-openapi adds .openapi.
        'application/json': { schema: onlineRespondentSchema.meta({ id: 'NewOnlineRespondent' }) },
      },
    },
  },
  responses: {
    201: {
      description: 'The respondent was saved',
      content: { 'application/json': { schema: RespondentSummarySchema } },
    },
    400: errorResponse(
      'A field is missing or not valid, a school field was sent, or the notice is out of date',
    ),
    401: errorResponse('Not signed in, or the sign-in has expired'),
    403: errorResponse('Signed in as staff'),
    409: errorResponse('This account already has a respondent'),
    429: rateLimited('this account'),
  },
})
