import { areaCodeSchema, difficultySchema, questionInputSchema } from '@digibridge/shared'
import { createRoute, z } from '@hono/zod-openapi'
import { auth, requireRole } from '../middleware'
import { errorResponse } from '../openapi'
import { ADMIN_ERRORS } from './admin'

// The questions editor (CMS-01 to CMS-03). Admin only: it shows the right choice of every question.

/** A question as the editor's list shows it. */
const AdminQuestionSummarySchema = z
  .object({
    id: z.uuid(),
    area: areaCodeSchema,
    difficulty: difficultySchema,
    stem: z.string(),
    imageUrl: z.string().nullable(),
    isScenario: z.boolean(),
    isActive: z.boolean(),
    // Shown in at least one attempt, voided ones included: its area, difficulty and right choice
    // are locked, and it can't be deleted (CMS-02).
    shown: z.boolean(),
    updatedAt: z.iso.datetime(),
  })
  .openapi('AdminQuestionSummary')

/** A whole question, as the editor loads and saves it. */
export const AdminQuestionSchema = AdminQuestionSummarySchema.extend({
  explanation: z.string().nullable(),
  // In position order, A to D.
  choices: z.array(z.object({ id: z.uuid(), label: z.string(), isCorrect: z.boolean() })),
}).openapi('AdminQuestion')

const QuestionIdParamsSchema = z.object({
  id: z.uuid().openapi({ param: { name: 'id', in: 'path' }, description: 'The question' }),
})

const questionBody = <T extends z.ZodType>(schema: T, id: string) => ({
  body: {
    required: true,
    // .meta, not .openapi: shared schemas are built before @hono/zod-openapi adds .openapi.
    content: { 'application/json': { schema: schema.meta({ id }) } },
  },
})

const LOCK_NOTE =
  'Once any attempt has shown the question (voided ones too), its area, difficulty and right choice are locked, since scoring reads them at submit: only its wording, image, explanation, scenario flag and whether it is active can change (CMS-02).'

export const listAdminQuestionsRoute = createRoute({
  method: 'get',
  path: '/admin/questions',
  tags: ['Admin'],
  summary: 'Every question, inactive ones included',
  description: 'By area order, then difficulty, oldest first (CMS-01).',
  middleware: [auth, requireRole('admin')] as const,
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: 'The questions',
      content: {
        'application/json': {
          schema: z
            .object({ questions: z.array(AdminQuestionSummarySchema) })
            .openapi('AdminQuestionList'),
        },
      },
    },
    ...ADMIN_ERRORS,
  },
})

export const getAdminQuestionRoute = createRoute({
  method: 'get',
  path: '/admin/questions/{id}',
  tags: ['Admin'],
  summary: 'One question with its choices',
  description: 'Everything the editor shows, the right choice included (CMS-01).',
  middleware: [auth, requireRole('admin')] as const,
  security: [{ Bearer: [] }],
  request: { params: QuestionIdParamsSchema },
  responses: {
    200: {
      description: 'The question',
      content: { 'application/json': { schema: AdminQuestionSchema } },
    },
    400: errorResponse('The ID is not valid'),
    ...ADMIN_ERRORS,
    404: errorResponse('No question with this ID'),
  },
})

export const createQuestionRoute = createRoute({
  method: 'post',
  path: '/admin/questions',
  tags: ['Admin'],
  summary: 'Add a question',
  description:
    'With its area, difficulty, text, optional image link, explanation and exactly 4 choices, exactly 1 of them right (CMS-01, CMS-03).',
  middleware: [auth, requireRole('admin')] as const,
  security: [{ Bearer: [] }],
  request: questionBody(questionInputSchema, 'NewQuestion'),
  responses: {
    201: {
      description: 'The new question',
      content: { 'application/json': { schema: AdminQuestionSchema } },
    },
    400: errorResponse('A field is missing or not valid, or the choices aren’t 4 with 1 right'),
    ...ADMIN_ERRORS,
    404: errorResponse('The area isn’t set up (the areas were never seeded)'),
  },
})

export const updateQuestionRoute = createRoute({
  method: 'patch',
  path: '/admin/questions/{id}',
  tags: ['Admin'],
  summary: 'Edit a question',
  description: `Any of the fields a new question takes; the rest stay as they are. \`choices\`, when sent, is all 4 in position order: each keeps its ID, so answers already given still point at the same choice (CMS-01, CMS-03). ${LOCK_NOTE}`,
  middleware: [auth, requireRole('admin')] as const,
  security: [{ Bearer: [] }],
  request: {
    params: QuestionIdParamsSchema,
    ...questionBody(questionInputSchema.partial(), 'QuestionChanges'),
  },
  responses: {
    200: {
      description: 'The question as saved',
      content: { 'application/json': { schema: AdminQuestionSchema } },
    },
    400: errorResponse('A field or the ID is not valid'),
    ...ADMIN_ERRORS,
    404: errorResponse('No question with this ID, or the area it moves to isn’t set up'),
    409: errorResponse(
      'The question has been shown, and the change moves its area, difficulty or right choice',
    ),
  },
})

export const deleteQuestionRoute = createRoute({
  method: 'delete',
  path: '/admin/questions/{id}',
  tags: ['Admin'],
  summary: 'Delete a question nobody has seen',
  description:
    'Only a question no attempt has shown can be deleted, so past attempts keep every item they showed: make a shown one inactive instead (CMS-02).',
  middleware: [auth, requireRole('admin')] as const,
  security: [{ Bearer: [] }],
  request: { params: QuestionIdParamsSchema },
  responses: {
    204: { description: 'Deleted' },
    400: errorResponse('The ID is not valid'),
    ...ADMIN_ERRORS,
    404: errorResponse('No question with this ID'),
    409: errorResponse('An attempt has shown the question'),
  },
})
