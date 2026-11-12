import {
  areaCodeSchema,
  dashboardFiltersSchema,
  difficultySchema,
  itemFlagSchema,
} from '@digibridge/shared'
import { createRoute, z } from '@hono/zod-openapi'
import { auth, requireRole } from '../middleware'
import { errorResponse } from '../openapi'
import { SIGNED_IN_ERRORS } from './admin'

// Item analysis (DSH-08). Admin only: it shows the right choice of every question.

const ItemStatsSchema = z
  .object({
    questionId: z.uuid(),
    area: areaCodeSchema,
    difficulty: difficultySchema,
    stem: z.string(),
    isActive: z.boolean(),
    // Finished attempts that showed it, among respondents who match the filters.
    seen: z.int(),
    correct: z.int(),
    // correct ÷ seen, 0 to 100 to 2 decimals; null when nobody has seen it.
    correctPct: z.number().nullable(),
    // Seen but left unanswered.
    blank: z.int(),
    // In the question's own order (position), each with how many picked it.
    choices: z.array(
      z.object({ id: z.uuid(), label: z.string(), isCorrect: z.boolean(), picked: z.int() }),
    ),
    flags: z.array(itemFlagSchema),
  })
  .openapi('ItemStats')

export const itemAnalysisRoute = createRoute({
  method: 'get',
  path: '/admin/items',
  tags: ['Admin'],
  summary: 'Item analysis',
  description:
    'Every question, by area and difficulty, with how many finished attempts showed it, how many got it right, how often each choice was picked, and its flags: too easy, too hard or confusing (none until ITEM_FLAG_MIN_SEEN have seen it). Takes every dashboard filter. Admin only (DSH-08).',
  middleware: [auth, requireRole('admin')] as const,
  security: [{ Bearer: [] }],
  request: { query: dashboardFiltersSchema },
  responses: {
    200: {
      description: 'Every question',
      content: {
        'application/json': {
          schema: z.object({ items: z.array(ItemStatsSchema) }).openapi('ItemAnalysis'),
        },
      },
    },
    400: errorResponse('A filter is not valid'),
    ...SIGNED_IN_ERRORS,
    403: errorResponse('Not an admin'),
  },
})
