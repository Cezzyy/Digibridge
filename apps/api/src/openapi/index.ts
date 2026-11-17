import { RESPONDENT_TOKEN_HEADER } from '@digibridge/shared'
import type { OpenAPIHono } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import type { Env, MiddlewareHandler, Schema } from 'hono'
import type { Bindings } from '../env'
import { ApiError } from '../middleware/error'
import { docsSecurityHeaders } from '../middleware/security-headers'

export * from './error'

/** True when `API_DOCS` is "true": in `.dev.vars` locally, never in the deployed [vars]. */
export const apiDocsOn = (env: Pick<Bindings, 'API_DOCS'>) => env.API_DOCS === 'true'

// The spec and the docs page answer 404 while API_DOCS is off, as if they weren't there: the spec
// lists every route, so hiding only the page would leave the same map public.
const docsOnly: MiddlewareHandler = async (c, next) => {
  if (!apiDocsOn(c.env as Bindings)) throw new ApiError('not_found')
  await next()
}

// Serves the OpenAPI spec at /api/openapi.json and the docs page at /api/reference, while API_DOCS
// is on.
export function addApiDocs<E extends Env, S extends Schema>(app: OpenAPIHono<E, S, '/api'>) {
  app.use('/openapi.json', docsOnly)
  app.use('/reference', docsOnly, docsSecurityHeaders)
  // Routes that need sign-in list `security: [{ Bearer: [] }]`; the docs page then asks for a token.
  app.openAPIRegistry.registerComponent('securitySchemes', 'Bearer', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Supabase access token from Google sign-in',
  })
  // Respondent routes take this instead, from a school-link student: `[{ Bearer: [] }, { RespondentToken: [] }]`.
  app.openAPIRegistry.registerComponent('securitySchemes', 'RespondentToken', {
    type: 'apiKey',
    in: 'header',
    name: RESPONDENT_TOKEN_HEADER,
    description: 'The token POST /links/{code}/respondents gave a school-link student',
  })
  app.doc31('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'DigiBridge API', version: '0.0.0' },
  })
  // Sidebar shows each route's path (GET /api/v1/health) instead of its summary. The nonce is the
  // one the docs page's Content-Security-Policy allows (`docsSecurityHeaders`).
  app.get(
    '/reference',
    Scalar((c) => ({
      url: '/api/openapi.json',
      operationTitleSource: 'path',
      nonce: c.get('secureHeadersNonce') as string | undefined,
    })),
  )
}
