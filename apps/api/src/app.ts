import { OpenAPIHono } from '@hono/zod-openapi'
import type { AppEnv } from './env'
import { getHealth } from './handlers/health'
import { corsMiddleware, handleError, handleNotFound, validationHook } from './middleware'
import { addApiDocs } from './openapi'
import { healthRoute } from './routes/health'

// Version 1 routes. Each route is defined in routes/ and bound to its handler here.
// validationHook turns a failed Zod check into { error: { code, message } }.
const v1 = new OpenAPIHono<AppEnv>({ defaultHook: validationHook }).openapi(healthRoute, getHealth)

// Builds the Hono app: routes under /api/v1, docs under /api.
// CORS is added before the routes so it runs on every response, errors included.
const api = new OpenAPIHono<AppEnv>().basePath('/api')
api.use(corsMiddleware)
export const app = api.route('/v1', v1)

// Errors thrown anywhere, including in v1, end up here.
app.onError(handleError)
app.notFound(handleNotFound)

addApiDocs(app)

// Route types for the web app's typed client (import type only).
export type AppType = typeof app
