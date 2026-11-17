import { ERROR_CODES } from '@digibridge/shared'
import { z } from '@hono/zod-openapi'

export const ErrorSchema = z
  .object({
    error: z.object({
      code: z.enum(ERROR_CODES).openapi({ example: 'not_found' }),
      message: z.string().openapi({ example: "We couldn't find what you were looking for." }),
    }),
  })
  .openapi('Error')

/** An error entry for a route's `responses`, e.g. `409: errorResponse('Already answered')`. */
export function errorResponse(description: string) {
  return { description, content: { 'application/json': { schema: ErrorSchema } } }
}

/** The 429 of a route with its own rate limit (middleware/rate-limit.ts). */
export const rateLimited = (who: string) =>
  errorResponse(
    `Too many requests from ${who} in the last minute; \`Retry-After\` says when to try again`,
  )
