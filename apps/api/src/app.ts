import { OpenAPIHono } from '@hono/zod-openapi'
import type { AppEnv } from './env'
import { getAttempt, getResult, saveAnswer, startAttempt, submitAttempt } from './handlers/attempts'
import { getHealth } from './handlers/health'
import { getMe } from './handlers/me'
import { createRespondent } from './handlers/respondents'
import {
  corsMiddleware,
  dbMiddleware,
  handleError,
  handleNotFound,
  validationHook,
} from './middleware'
import { addApiDocs } from './openapi'
import {
  getAttemptRoute,
  getResultRoute,
  saveAnswerRoute,
  startAttemptRoute,
  submitAttemptRoute,
} from './routes/attempts'
import { healthRoute } from './routes/health'
import { meRoute } from './routes/me'
import { createRespondentRoute } from './routes/respondents'

// Version 1 routes. Each route is defined in routes/ and bound to its handler here.
// validationHook turns a failed Zod check into { error: { code, message } }.
const v1 = new OpenAPIHono<AppEnv>({ defaultHook: validationHook })
v1.use(dbMiddleware)
const v1Routes = v1
  .openapi(healthRoute, getHealth)
  .openapi(meRoute, getMe)
  .openapi(createRespondentRoute, createRespondent)
  .openapi(startAttemptRoute, startAttempt)
  .openapi(getAttemptRoute, getAttempt)
  .openapi(saveAnswerRoute, saveAnswer)
  .openapi(submitAttemptRoute, submitAttempt)
  .openapi(getResultRoute, getResult)

// Builds the Hono app: routes under /api/v1, docs under /api.
// CORS is added before the routes so it runs on every response, errors included.
const api = new OpenAPIHono<AppEnv>().basePath('/api')
api.use(corsMiddleware)
export const app = api.route('/v1', v1Routes)

// Errors thrown anywhere, including in v1, end up here.
app.onError(handleError)
app.notFound(handleNotFound)

addApiDocs(app)

// Route types for the web app's typed client (import type only).
export type AppType = typeof app
