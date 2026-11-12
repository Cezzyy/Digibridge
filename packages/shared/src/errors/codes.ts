import { z } from 'zod'

// Codes the API sends in { error: { code, message } }. The web app switches on these,
// never on the message text.
export const ERROR_CODES = [
  'bad_request',
  'validation_failed',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'already_answered',
  // A school link that closed, expired or filled up (410).
  'gone',
  'too_large',
  'rate_limited',
  'internal_error',
] as const
export const errorCodeSchema = z.enum(ERROR_CODES)
export type ErrorCode = (typeof ERROR_CODES)[number]
