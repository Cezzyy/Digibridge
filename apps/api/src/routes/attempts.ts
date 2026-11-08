import { attemptStatusSchema } from '@digibridge/shared'
import { createRoute, z } from '@hono/zod-openapi'
import { auth, requireRole } from '../middleware'
import { errorResponse } from '../openapi'

/** An attempt's id, state and clock. The items come from GET /attempts/:id. */
export const AttemptSummarySchema = z
  .object({
    id: z.uuid(),
    status: attemptStatusSchema,
    startedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    // The server's clock when it answered, so the countdown doesn't trust the phone's (ASM-09).
    serverTime: z.iso.datetime(),
  })
  .openapi('AttemptSummary')

export const startAttemptRoute = createRoute({
  method: 'post',
  path: '/attempts',
  tags: ['Assessment'],
  summary: 'Start the attempt, or return the one in progress',
  description:
    'Picks 4 basic, 4 intermediate and 2 advanced active items per area, shuffles the items together and each item’s choices, and sets `expires_at` (ASM-01, ASM-02). Calling it again returns the attempt in progress. One attempt per respondent; a voided one frees the slot (PRO-07). Respondents only: staff preview the flow without saving.',
  // Kiosk mode will let facilitators in too, with a kiosk session.
  middleware: [auth, requireRole('respondent')] as const,
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: 'The attempt already in progress',
      content: { 'application/json': { schema: AttemptSummarySchema } },
    },
    201: {
      description: 'A new attempt was started',
      content: { 'application/json': { schema: AttemptSummarySchema } },
    },
    401: errorResponse('Not signed in, or the sign-in has expired'),
    403: errorResponse('Signed in as staff'),
    409: errorResponse(
      'No profile yet, the assessment was already taken, or there are too few active items',
    ),
  },
})
