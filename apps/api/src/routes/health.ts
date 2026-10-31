import { createRoute, z } from '@hono/zod-openapi'

const HealthSchema = z.object({ status: z.literal('ok') }).openapi('Health')

export const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: 'Check that the API is running',
  responses: {
    200: {
      description: 'The API is running',
      content: { 'application/json': { schema: HealthSchema } },
    },
  },
})
