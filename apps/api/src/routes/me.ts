import { attemptStatusSchema, roleSchema } from '@digibridge/shared'
import { createRoute, z } from '@hono/zod-openapi'
import { auth } from '../middleware'
import { errorResponse } from '../openapi'
import { RespondentSummarySchema } from './respondents'

const MeSchema = z
  .object({
    profile: z.object({
      id: z.uuid(),
      email: z.string(),
      fullName: z.string().nullable(),
      avatarUrl: z.string().nullable(),
      role: roleSchema,
    }),
    // Null until the user agrees to the consent notice and fills in their profile, and always
    // for staff (even with a respondent from before their role changed).
    // Online respondents have no school details, so none are sent (PRO-06).
    respondent: RespondentSummarySchema.nullable(),
    // Their one attempt, unless it was voided (then they can start again).
    attempt: z.object({ id: z.uuid(), status: attemptStatusSchema }).nullable(),
  })
  .openapi('Me')

export const meRoute = createRoute({
  method: 'get',
  path: '/me',
  tags: ['Respondent'],
  summary: 'Profile, role, own respondent record and attempt status',
  middleware: [auth] as const,
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: 'The signed-in user',
      content: { 'application/json': { schema: MeSchema } },
    },
    401: errorResponse('Not signed in, or the sign-in has expired'),
  },
})
