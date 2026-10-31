import { OpenAPIHono } from '@hono/zod-openapi'
import { getHealth } from './handlers/health'
import { addApiDocs } from './openapi'
import { healthRoute } from './routes/health'

// Version 1 routes. Each route is defined in routes/ and bound to its handler here.
const v1 = new OpenAPIHono().openapi(healthRoute, getHealth)

// Builds the Hono app: routes under /api/v1, docs under /api.
export const app = new OpenAPIHono().basePath('/api').route('/v1', v1)

addApiDocs(app)

// Route types for the web app's typed client (import type only).
export type AppType = typeof app
