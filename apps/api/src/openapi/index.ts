import type { OpenAPIHono } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import type { Env, Schema } from 'hono'

export * from './error'

// Serves the OpenAPI spec at /api/openapi.json and the docs page at /api/reference.
export function addApiDocs<E extends Env, S extends Schema>(app: OpenAPIHono<E, S, '/api'>) {
  app.doc31('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'DigiBridge API', version: '0.0.0' },
  })
  // Sidebar shows each route's path (GET /api/v1/health) instead of its summary.
  app.get('/reference', Scalar({ url: '/api/openapi.json', operationTitleSource: 'path' }))
}
