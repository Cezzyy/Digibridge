import {
  ANSWER_GRACE_SECONDS,
  areaCodeSchema,
  attemptStatusSchema,
  lessonTierSchema,
  levelSchema,
} from '@digibridge/shared'
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

const AttemptParamsSchema = z.object({
  id: z.uuid().openapi({ param: { name: 'id', in: 'path' }, description: 'The attempt' }),
})

const SELF_ONLY =
  'Only for the respondent the attempt belongs to; anyone else gets 404, so attempt IDs reveal nothing.'

/** One item as the respondent sees it: no right answer, no difficulty (RES-05). */
const AttemptItemSchema = z.object({
  id: z.uuid(),
  area: areaCodeSchema,
  stem: z.string(),
  imageUrl: z.string().nullable(),
  isScenario: z.boolean(),
  // In the order shown for this attempt (ASM-02).
  choices: z.array(z.object({ id: z.uuid(), label: z.string() })),
})

const SavedAnswerSchema = z.object({ questionId: z.uuid(), choiceId: z.uuid() })

/** Everything the assessment page needs to show or resume the attempt (ASM-07). */
export const AttemptSchema = AttemptSummarySchema.extend({
  // In the order shown for this attempt (ASM-02).
  items: z.array(AttemptItemSchema),
  answers: z.array(SavedAnswerSchema),
}).openapi('Attempt')

export const getAttemptRoute = createRoute({
  method: 'get',
  path: '/attempts/{id}',
  tags: ['Assessment'],
  summary: 'The attempt’s items, saved answers and clock',
  description: `Items and choices in this attempt’s shuffled order, without the right answers, plus the answers saved so far, \`expires_at\` and the server time for the countdown (ASM-02, ASM-07, ASM-09). ${SELF_ONLY}`,
  middleware: [auth, requireRole('respondent')] as const,
  security: [{ Bearer: [] }],
  request: { params: AttemptParamsSchema },
  responses: {
    200: {
      description: 'The attempt',
      content: { 'application/json': { schema: AttemptSchema } },
    },
    401: errorResponse('Not signed in, or the sign-in has expired'),
    403: errorResponse('Signed in as staff'),
    404: errorResponse('No such attempt for this respondent'),
  },
})

const AnswerParamsSchema = AttemptParamsSchema.extend({
  questionId: z
    .uuid()
    .openapi({ param: { name: 'questionId', in: 'path' }, description: 'The item answered' }),
})

const SaveAnswerBodySchema = z
  .object({ choiceId: z.uuid().openapi({ description: 'One of the item’s 4 choices' }) })
  .openapi('SaveAnswer')

export const SavedAnswerReplySchema = SavedAnswerSchema.extend({
  answeredAt: z.iso.datetime(),
  serverTime: z.iso.datetime(),
}).openapi('SavedAnswer')

export const saveAnswerRoute = createRoute({
  method: 'put',
  path: '/attempts/{id}/answers/{questionId}',
  tags: ['Assessment'],
  summary: 'Save or change one answer',
  description: `Saves the choice for one item, replacing any earlier one (ASM-04, ASM-05). The item must be in the attempt and the choice must be one of its own. Refused once the attempt is closed, or more than ${ANSWER_GRACE_SECONDS} seconds after \`expires_at\` (ASM-09). ${SELF_ONLY}`,
  middleware: [auth, requireRole('respondent')] as const,
  security: [{ Bearer: [] }],
  request: {
    params: AnswerParamsSchema,
    body: { required: true, content: { 'application/json': { schema: SaveAnswerBodySchema } } },
  },
  responses: {
    200: {
      description: 'The answer was saved',
      content: { 'application/json': { schema: SavedAnswerReplySchema } },
    },
    400: errorResponse('The item isn’t in the attempt, or the choice isn’t one of its own'),
    401: errorResponse('Not signed in, or the sign-in has expired'),
    403: errorResponse('Signed in as staff'),
    404: errorResponse('No such attempt for this respondent'),
    409: errorResponse('The attempt is closed, or its time is up'),
  },
})

export const SubmittedAttemptSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(['submitted', 'expired']),
    submittedAt: z.iso.datetime(),
  })
  .openapi('SubmittedAttempt')

export const submitAttemptRoute = createRoute({
  method: 'post',
  path: '/attempts/{id}/submit',
  tags: ['Assessment'],
  summary: 'Score and close the attempt',
  description: `Scores the saved answers (unanswered items earn 0), writes each answer’s points, one result per area and the overall score and level, all in one transaction (PRD scoring rules). Sent after \`expires_at\` plus the grace period, the attempt closes as \`expired\`. Safe to call twice: a closed attempt is returned as it is. ${SELF_ONLY}`,
  middleware: [auth, requireRole('respondent')] as const,
  security: [{ Bearer: [] }],
  request: { params: AttemptParamsSchema },
  responses: {
    200: {
      description: 'The closed attempt',
      content: { 'application/json': { schema: SubmittedAttemptSchema } },
    },
    401: errorResponse('Not signed in, or the sign-in has expired'),
    403: errorResponse('Signed in as staff'),
    404: errorResponse('No such attempt for this respondent'),
    409: errorResponse('The attempt was voided'),
  },
})

const ScoreSchema = z.object({
  points: z.int(),
  maxPoints: z.int(),
  // Rounded to 2 decimals, as saved; the level comes from the unrounded one.
  pct: z.number(),
  level: levelSchema,
})

/** A lesson tier recommended for the area's level, with its published lesson if there is one. */
const LessonPickSchema = z.object({
  tier: lessonTierSchema,
  // The second tier for a Basic or Intermediate level: the step after the first lesson.
  nextStep: z.boolean(),
  lesson: z
    .object({ slug: z.string(), title: z.string(), summary: z.string() })
    .nullable()
    .openapi({ description: 'Null until the team publishes this area’s lesson for the tier' }),
})

/** What the results page shows: scores and levels, never which items were right (RES-05). */
export const AttemptResultSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(['submitted', 'expired']),
    submittedAt: z.iso.datetime(),
    overall: ScoreSchema,
    // In the areas' order.
    areas: z.array(
      ScoreSchema.extend({ area: areaCodeSchema, lessons: z.array(LessonPickSchema) }),
    ),
    // Set at submit once the QR code link is built (RES-04); null until then.
    resultsToken: z.string().nullable(),
    susAnswered: z.boolean(),
  })
  .openapi('AttemptResult')

export const getResultRoute = createRoute({
  method: 'get',
  path: '/attempts/{id}/result',
  tags: ['Results'],
  summary: 'The closed attempt’s scores, levels and lessons',
  description: `The overall score and level, and each area’s score, level and recommended lessons (RES-01, RES-02). Scores only: which items were right or wrong is never sent (RES-05). ${SELF_ONLY}`,
  middleware: [auth, requireRole('respondent')] as const,
  security: [{ Bearer: [] }],
  request: { params: AttemptParamsSchema },
  responses: {
    200: {
      description: 'The result',
      content: { 'application/json': { schema: AttemptResultSchema } },
    },
    401: errorResponse('Not signed in, or the sign-in has expired'),
    403: errorResponse('Signed in as staff'),
    404: errorResponse('No such attempt for this respondent'),
    409: errorResponse('The attempt is still in progress, or was voided'),
  },
})
