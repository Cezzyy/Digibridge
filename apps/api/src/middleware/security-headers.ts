import type { MiddlewareHandler } from 'hono'
import { createMiddleware } from 'hono/factory'
import { NONCE, secureHeaders } from 'hono/secure-headers'

// Security headers on every API response, errors included (the web app's own are in
// apps/web/security-headers.ts). Hono's defaults also send nosniff, COOP and CORP same-origin,
// Origin-Agent-Cluster and the rest; CORP doesn't apply to the web app's CORS requests.

/** The docs page, the one HTML page the API serves (openapi/index.ts). */
export const DOCS_PATH = '/api/reference'

const shared = {
  strictTransportSecurity: 'max-age=31536000; includeSubDomains',
  xFrameOptions: 'DENY',
  referrerPolicy: 'no-referrer',
} as const

// JSON and files only: nothing may run, load or frame it.
const apiHeaders = secureHeaders({
  ...shared,
  contentSecurityPolicy: {
    defaultSrc: ["'none'"],
    frameAncestors: ["'none'"],
    baseUri: ["'none'"],
    formAction: ["'none'"],
  },
})

// Scalar: its script from jsdelivr plus an inline one, both carrying this response's nonce (passed
// to Scalar in openapi/index.ts); it injects styles and fonts, and fetches the spec from here.
const docsHeaders = secureHeaders({
  ...shared,
  contentSecurityPolicy: {
    defaultSrc: ["'none'"],
    scriptSrc: [NONCE, 'https://cdn.jsdelivr.net'],
    styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
    fontSrc: ["'self'", 'https:', 'data:'],
    imgSrc: ["'self'", 'https:', 'data:'],
    connectSrc: ["'self'"],
    workerSrc: ["'self'", 'blob:'],
    frameAncestors: ["'none'"],
    baseUri: ["'none'"],
    formAction: ["'none'"],
  },
})

/**
 * The headers for the response's path, plus `Cache-Control: no-store` unless the route set its own,
 * so answers, results and the dashboard never sit in a shared or browser cache.
 */
export const securityHeaders: MiddlewareHandler = createMiddleware(async (c, next) => {
  await (c.req.path === DOCS_PATH ? docsHeaders : apiHeaders)(c, next)
  if (!c.res.headers.has('Cache-Control')) c.res.headers.set('Cache-Control', 'no-store')
})
