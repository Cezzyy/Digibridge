import type { ErrorCode } from '@digibridge/shared'
import type { OpenAPIHonoOptions } from '@hono/zod-openapi'
import type { Context, ErrorHandler, NotFoundHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { AppEnv } from '../env'

// Every error leaves the API as { error: { code, message } } (TRD, API section).

const STATUS_BY_CODE = {
  bad_request: 400,
  validation_failed: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  internal_error: 500,
} as const satisfies Record<ErrorCode, ContentfulStatusCode>

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  bad_request: 'The request could not be read. Please try again.',
  validation_failed: 'Some of the details sent are missing or not valid.',
  unauthorized: 'Please sign in to continue.',
  forbidden: "You don't have access to this.",
  not_found: "We couldn't find what you were looking for.",
  conflict: 'This was already done.',
  internal_error: 'Something went wrong on our side. Please try again.',
}

/** Throw from a handler to send an error. The status comes from the code. */
export class ApiError extends Error {
  readonly code: ErrorCode
  readonly status: ContentfulStatusCode

  constructor(code: ErrorCode, message = DEFAULT_MESSAGES[code]) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = STATUS_BY_CODE[code]
  }
}

function sendError(c: Context, code: ErrorCode, message = DEFAULT_MESSAGES[code]) {
  return c.json({ error: { code, message } }, STATUS_BY_CODE[code])
}

// Hono's own errors (e.g. malformed JSON) carry a status but no code.
function codeForStatus(status: number): ErrorCode {
  const match = (Object.keys(STATUS_BY_CODE) as ErrorCode[]).find(
    (code) => code !== 'validation_failed' && STATUS_BY_CODE[code] === status,
  )
  if (match) return match
  return status < 500 ? 'bad_request' : 'internal_error'
}

/** app.onError: turns anything thrown into the error shape. */
export const handleError: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof ApiError) return sendError(c, err.code, err.message)
  if (err instanceof HTTPException) return sendError(c, codeForStatus(err.status))
  console.error(err)
  return sendError(c, 'internal_error')
}

/** app.notFound: no route matched. */
export const handleNotFound: NotFoundHandler<AppEnv> = (c) => sendError(c, 'not_found')

/**
 * defaultHook for OpenAPIHono: a request that fails its route's Zod schema gets a 400.
 * The message is the first issue's, so the shared schemas' plain-English messages reach the user.
 */
export const validationHook: NonNullable<OpenAPIHonoOptions<AppEnv>['defaultHook']> = (
  result,
  c,
) => {
  if (!result.success) {
    return sendError(c, 'validation_failed', result.error.issues[0]?.message)
  }
}
