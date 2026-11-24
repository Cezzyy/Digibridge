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
import {
  createLesson,
  deleteLesson,
  getAdminLesson,
  listAdminLessons,
  updateLesson,
} from './handlers/admin-lessons'
import {
  createQuestion,
  deleteQuestion,
  getAdminQuestion,
  listAdminQuestions,
  updateQuestion,
} from './handlers/admin-questions'
import {
  deleteRespondent,
  getRespondent,
  listRespondents,
  voidAttempt,
} from './handlers/admin-respondents'
import { exportCsv, exportXlsx } from './handlers/admin-export'
import { getItemAnalysis } from './handlers/admin-items'
import { getStats } from './handlers/admin-stats'
import { getHealth } from './handlers/health'
import { getLesson, listLessons } from './handlers/lessons'
import { getLink, joinLink } from './handlers/links'
import { getMe } from './handlers/me'
import { previewResult, startPreview } from './handlers/preview'
import { createRespondent } from './handlers/respondents'
import {
  apiRateLimit,
  corsMiddleware,
  dbMiddleware,
  handleError,
  handleNotFound,
  securityHeaders,
  validationHook,
} from './middleware'
import { addApiDocs } from './openapi'
import { closeLinkRoute, createLinkRoute, listLinksRoute, overviewRoute } from './routes/admin'
import {
  createLessonRoute,
  deleteLessonRoute,
  getAdminLessonRoute,
  listAdminLessonsRoute,
  updateLessonRoute,
} from './routes/admin-lessons'
import {
  createQuestionRoute,
  deleteQuestionRoute,
  getAdminQuestionRoute,
  listAdminQuestionsRoute,
  updateQuestionRoute,
} from './routes/admin-questions'
import {
  deleteRespondentRoute,
  getRespondentRoute,
  listRespondentsRoute,
  voidAttemptRoute,
} from './routes/admin-respondents'
import { exportCsvRoute, exportXlsxRoute } from './routes/admin-export'
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
import { getLinkRoute, joinLinkRoute } from './routes/links'
import { meRoute } from './routes/me'
import { previewResultRoute, startPreviewRoute } from './routes/preview'
import { createRespondentRoute } from './routes/respondents'

// Version 1 routes. Each route is defined in routes/ and bound to its handler here.
// validationHook turns a failed Zod check into { error: { code, message } }.
// The per-IP catch-all limit runs first, so a refused request never opens a connection.
const v1 = new OpenAPIHono<AppEnv>({ defaultHook: validationHook })
v1.use(apiRateLimit)
v1.use(dbMiddleware)
const v1Routes = v1
  .openapi(healthRoute, getHealth)
  .openapi(meRoute, getMe)
  .openapi(createRespondentRoute, createRespondent)
  .openapi(getLinkRoute, getLink)
  .openapi(joinLinkRoute, joinLink)
  .openapi(startAttemptRoute, startAttempt)
  .openapi(getAttemptRoute, getAttempt)
  .openapi(saveAnswerRoute, saveAnswer)
  .openapi(submitAttemptRoute, submitAttempt)
  .openapi(getResultRoute, getResult)
  .openapi(saveSusRoute, saveSus)
  .openapi(startPreviewRoute, startPreview)
  .openapi(previewResultRoute, previewResult)
  .openapi(listLessonsRoute, listLessons)
  .openapi(getLessonRoute, getLesson)
  .openapi(overviewRoute, getOverview)
  .openapi(listLinksRoute, listLinks)
  .openapi(createLinkRoute, createLink)
  .openapi(closeLinkRoute, closeLink)
  .openapi(listRespondentsRoute, listRespondents)
  .openapi(getRespondentRoute, getRespondent)
  .openapi(deleteRespondentRoute, deleteRespondent)
  .openapi(voidAttemptRoute, voidAttempt)
  .openapi(statsRoute, getStats)
  .openapi(exportCsvRoute, exportCsv)
  .openapi(exportXlsxRoute, exportXlsx)
  .openapi(itemAnalysisRoute, getItemAnalysis)
  .openapi(listAdminLessonsRoute, listAdminLessons)
  .openapi(getAdminLessonRoute, getAdminLesson)
  .openapi(createLessonRoute, createLesson)
  .openapi(updateLessonRoute, updateLesson)
  .openapi(deleteLessonRoute, deleteLesson)
  .openapi(listAdminQuestionsRoute, listAdminQuestions)
  .openapi(getAdminQuestionRoute, getAdminQuestion)
  .openapi(createQuestionRoute, createQuestion)
  .openapi(updateQuestionRoute, updateQuestion)
  .openapi(deleteQuestionRoute, deleteQuestion)

// Builds the Hono app: routes under /api/v1, docs under /api.
// Security headers and CORS are added before the routes so they run on every response, errors
// and the docs included.
const api = new OpenAPIHono<AppEnv>().basePath('/api')
api.use(securityHeaders)
api.use(corsMiddleware)
export const app = api.route('/v1', v1Routes)

// Errors thrown anywhere, including in v1, end up here.
app.onError(handleError)
app.notFound(handleNotFound)

addApiDocs(app)

// Route types for the web app's typed client (import type only).
export type AppType = typeof app
