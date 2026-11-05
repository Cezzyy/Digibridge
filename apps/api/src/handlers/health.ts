import type { RouteHandler } from '@hono/zod-openapi'
import type { AppEnv } from '../env'
import type { healthRoute } from '../routes/health'

export const getHealth: RouteHandler<typeof healthRoute, AppEnv> = (c) =>
  c.json({ status: 'ok' }, 200)
