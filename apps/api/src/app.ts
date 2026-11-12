import { OpenAPIHono } from '@hono/zod-openapi'
import type { AppEnv } from './env'
import {
  getAttempt,
  getResult,
  saveAnswer,
  saveSus,
  startAttempt,
  submitAttempt,
} from './handlers/attempts'
import { closeLink, createLink, getOverview, listLinks } from './handlers/admin'
import { getRespondent, listRespondents } from './handlers/admin-respondents'
import { getItemAnalysis } from './handlers/admin-items'
import { getStats } from './handlers/admin-stats'
import { getHealth } from './handlers/health'
import { getLesson, listLessons } from './handlers/lessons'
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
import { closeLinkRoute, createLinkRoute, listLinksRoute, overviewRoute } from './routes/admin'
import { getRespondentRoute, listRespondentsRoute } from './routes/admin-respondents'
import { itemAnalysisRoute } from './routes/admin-items'
import { statsRoute } from './routes/admin-stats'
import {
  getAttemptRoute,
  getResultRoute,
  saveAnswerRoute,
  saveSusRoute,
  startAttemptRoute,
  submitAttemptRoute,
} from './routes/attempts'
import { healthRoute } from './routes/health'
import { getLessonRoute, listLessonsRoute } from './routes/lessons'
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
  .openapi(saveSusRoute, saveSus)
  .openapi(listLessonsRoute, listLessons)
  .openapi(getLessonRoute, getLesson)
  .openapi(overviewRoute, getOverview)
  .openapi(listLinksRoute, listLinks)
  .openapi(createLinkRoute, createLink)
  .openapi(closeLinkRoute, closeLink)
  .openapi(listRespondentsRoute, listRespondents)
  .openapi(getRespondentRoute, getRespondent)
  .openapi(statsRoute, getStats)
  .openapi(itemAnalysisRoute, getItemAnalysis)

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
