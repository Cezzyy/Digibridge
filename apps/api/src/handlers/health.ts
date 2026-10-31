import type { RouteHandler } from '@hono/zod-openapi'
import type { healthRoute } from '../routes/health'

export const getHealth: RouteHandler<typeof healthRoute> = (c) => c.json({ status: 'ok' }, 200)
