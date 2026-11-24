import { ITEMS_PER_ATTEMPT, STAFF_ROLES } from '@digibridge/shared'
import { createRoute, z } from '@hono/zod-openapi'
import { accountActionLimit, auth, requireRole } from '../middleware'
import { errorResponse, rateLimited } from '../openapi'
import { STAFF_ERRORS } from './admin'
import { AttemptResultSchema, AttemptSchema } from './attempts'

// The staff preview of the student steps (PRD "Home": staff get a preview). Staff never get an
// attempt, so these build one and score it without saving anything: their tries stay out of the
// research data, and off a school link's limit.

const NOTHING_SAVED = 'Nothing is saved. Staff only.'

export const startPreviewRoute = createRoute({
  method: 'post',
  path: '/preview/attempts',
  tags: ['Preview'],
  summary: 'A sample assessment for staff',
  description: `Picks and shuffles items and choices as a real start does (ASM-01, ASM-02), and returns them as the assessment page reads an attempt, with a made-up ID and an \`expiresAt\` for the timer. ${NOTHING_SAVED}`,
  middleware: [auth, requireRole(...STAFF_ROLES), accountActionLimit('preview')] as const,
  security: [{ Bearer: [] }],
  responses: {
    201: {
      description: 'The sample assessment',
      content: { 'application/json': { schema: AttemptSchema } },
    },
    ...STAFF_ERRORS,
    409: errorResponse('There are too few active items'),
    429: rateLimited('this account'),
  },
})

const PreviewAnswerSchema = z.object({ questionId: z.uuid(), choiceId: z.uuid() })

const PreviewResultBodySchema = z
  .object({
    id: z.uuid().openapi({ description: 'The sample assessment’s ID, sent back in the result' }),
    // In the order shown.
    questionIds: z
      .array(z.uuid())
      .min(1)
      .max(ITEMS_PER_ATTEMPT)
      .refine((ids) => new Set(ids).size === ids.length, 'Each question once'),
    answers: z
      .array(PreviewAnswerSchema)
      .max(ITEMS_PER_ATTEMPT)
      .refine(
        (answers) => new Set(answers.map((a) => a.questionId)).size === answers.length,
        'One answer per question',
      ),
    timeUp: z.boolean().openapi({ description: 'The timer ran out: the result reads expired' }),
  })
  .openapi('PreviewResultRequest')

export const previewResultRoute = createRoute({
  method: 'post',
  path: '/preview/result',
  tags: ['Preview'],
  summary: 'Score a sample assessment for staff',
  description: `Scores the answers to a sample assessment as a submit does, and returns the result the results page shows: levels and lessons per area, no marks per item (RES-01, RES-02, RES-05). ${NOTHING_SAVED}`,
  middleware: [auth, requireRole(...STAFF_ROLES), accountActionLimit('preview')] as const,
  security: [{ Bearer: [] }],
  request: {
    body: { required: true, content: { 'application/json': { schema: PreviewResultBodySchema } } },
  },
  responses: {
    200: {
      description: 'The sample result',
      content: { 'application/json': { schema: AttemptResultSchema } },
    },
    400: errorResponse('An answer to a question not in the list, or a choice of another question'),
    ...STAFF_ERRORS,
    409: errorResponse('A question was deleted since the preview started'),
    429: rateLimited('this account'),
  },
})
