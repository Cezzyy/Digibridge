import { RESPONDENT_TOKEN_HEADER } from '@digibridge/shared'
import type { OpenAPIHono } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import type { Env, Schema } from 'hono'

export * from './error'

// Serves the OpenAPI spec at /api/openapi.json and the docs page at /api/reference.
export function addApiDocs<E extends Env, S extends Schema>(app: OpenAPIHono<E, S, '/api'>) {
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
  // one the docs page's Content-Security-Policy allows (middleware/security-headers.ts).
  app.get(
    '/reference',
    Scalar((c) => ({
      url: '/api/openapi.json',
      operationTitleSource: 'path',
      nonce: c.get('secureHeadersNonce') as string | undefined,
    })),
  )
}
