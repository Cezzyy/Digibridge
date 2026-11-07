import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { describe, expect, it, vi } from 'vitest'
import { app } from './app'
import type { AppEnv, Bindings } from './env'
import { ApiError, handleError, handleNotFound, validationHook } from './middleware'

const WEB_ORIGIN = 'http://localhost:5173'
const env = { WEB_ORIGIN } as Bindings

describe('GET /api/v1/health', () => {
  it('answers ok', async () => {
    const res = await app.request('/api/v1/health', {}, env)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})

describe('errors', () => {
  it('sends not_found for an unknown route', async () => {
    const res = await app.request('/api/v1/nope', {}, env)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({
      error: { code: 'not_found', message: expect.any(String) },
    })
  })

  // A stand-in app with the same error setup as app.ts and routes that fail on purpose.
  const echoRoute = createRoute({
    method: 'post',
    path: '/echo',
    request: {
      body: {
        content: {
          'application/json': { schema: z.object({ name: z.string().min(1, 'Enter your name') }) },
        },
      },
    },
    responses: { 200: { description: 'Echo' } },
  })
  const testApp = new OpenAPIHono<AppEnv>({ defaultHook: validationHook })
    .openapi(echoRoute, (c) => c.json(c.req.valid('json'), 200))
    .get('/conflict', () => {
      throw new ApiError('conflict', 'This student number already finished the assessment.')
    })
    .get('/crash', () => {
      throw new Error('boom')
    })
  testApp.onError(handleError)
  testApp.notFound(handleNotFound)

  const postJson = (body: string) =>
    testApp.request('/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

  it('sends validation_failed with the schema message for bad input', async () => {
    const res = await postJson(JSON.stringify({ name: '' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: { code: 'validation_failed', message: 'Enter your name' },
    })
  })

  it('sends bad_request for malformed JSON', async () => {
    const res = await postJson('{')
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: { code: 'bad_request' } })
  })

  it('sends the status and message of a thrown ApiError', async () => {
    const res = await testApp.request('/conflict')
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: { code: 'conflict', message: 'This student number already finished the assessment.' },
    })
  })

  it('hides the details of an unexpected error', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await testApp.request('/crash')
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body).toMatchObject({ error: { code: 'internal_error' } })
    expect(JSON.stringify(body)).not.toContain('boom')
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })
})

describe('CORS', () => {
  const preflight = (origin: string) =>
    app.request(
      '/api/v1/health',
      {
        method: 'OPTIONS',
        headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' },
      },
      env,
    )

  it('allows the web origin', async () => {
    const res = await preflight(WEB_ORIGIN)
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(WEB_ORIGIN)
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization')
  })

  it('refuses other origins', async () => {
    const res = await preflight('https://evil.example')
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('adds the header to error responses too', async () => {
    const res = await app.request('/api/v1/nope', { headers: { Origin: WEB_ORIGIN } }, env)
    expect(res.status).toBe(404)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(WEB_ORIGIN)
  })
})
