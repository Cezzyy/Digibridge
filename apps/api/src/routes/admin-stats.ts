import {
  areaCodeSchema,
  STAFF_ROLES,
  statsGroupSchema,
  statsQuerySchema,
  SUS_STATEMENT_COUNT,
} from '@digibridge/shared'
import { createRoute, z } from '@hono/zod-openapi'
import { auth, requireRole } from '../middleware'
import { errorResponse } from '../openapi'
import { STAFF_ERRORS } from './admin'

// The analysis page (DSH-01 to DSH-04, SUS-05). Scores count finished attempts only (submitted,
// or closed by the timer); voided ones count nowhere. Percentages are 0 to 100, to 2 decimals,
// and null when nobody counts.

/** How many reached each level. */
const LevelCountsSchema = z
  .object({ beginner: z.int(), basic: z.int(), intermediate: z.int(), advanced: z.int() })
  .openapi('LevelCounts')

const AreaAverageSchema = z.object({ area: areaCodeSchema, averagePct: z.number().nullable() })

const StatsSchema = z
  .object({
    // Respondents who saved a profile and match the filters.
    respondents: z.int(),
    // Of them, those with a finished attempt.
    finished: z.int(),
    // finished ÷ respondents, 0 to 100.
    completionRate: z.number().nullable(),
    averageOverallPct: z.number().nullable(),
    medianTimeSeconds: z.number().nullable(),
    overallLevels: LevelCountsSchema,
    // In the areas' order, each with how many reached each level there (DSH-02).
    areas: z.array(AreaAverageSchema.extend({ levels: LevelCountsSchema })),
    sus: z.object({
      responses: z.int(),
      mean: z.number().nullable(),
      // SUS_BIN_WIDTH wide, from 0 up; 100 goes in the last.
      bins: z.array(z.object({ from: z.number(), to: z.number(), count: z.int() })),
      // The average answer (1 to 5) to each statement, in statement order.
      statementMeans: z.array(z.number().nullable()).length(SUS_STATEMENT_COUNT),
    }),
    // Average scores by the chosen grouping (DSH-04).
    comparison: z.object({
      groupBy: statsGroupSchema,
      groups: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          finished: z.int(),
          averageOverallPct: z.number().nullable(),
          areas: z.array(AreaAverageSchema),
        }),
      ),
    }),
  })
  .openapi('AdminStats')

export const statsRoute = createRoute({
  method: 'get',
  path: '/admin/stats',
  tags: ['Admin'],
  summary: 'Numbers and charts for the analysis page',
  description:
    'Summary cards (including mean SUS and the number of SUS responses), level counts overall and per area, the SUS spread and statement averages, and average scores by `groupBy`. Takes every dashboard filter. Course, year level and school link, as filters or groupings, count school respondents only. A respondent with several devices or ways to get internet counts in each of them. Staff (DSH-01 to DSH-04, SUS-05).',
  middleware: [auth, requireRole(...STAFF_ROLES)] as const,
  security: [{ Bearer: [] }],
  request: { query: statsQuerySchema },
  responses: {
    200: {
      description: 'The numbers',
      content: { 'application/json': { schema: StatsSchema } },
    },
    400: errorResponse('A filter or the grouping is not valid'),
    ...STAFF_ERRORS,
  },
})
