import { RESPONDENT_TOKEN_HEADER } from '@digibridge/shared'
import { createMiddleware } from 'hono/factory'
import type { RespondentEnv } from '../env'
import { hashRespondentToken, isRespondentToken } from '../lib/respondent-token'
import { authenticate } from './auth'
import { ApiError } from './error'

/** Sent when the token doesn't match a respondent, so the browser can drop it and start over. */
export const UNKNOWN_TOKEN_MESSAGE =
  'This device no longer has your place. Open the link from your school again.'

/**
 * For the respondent's own routes (the attempt, results and survey). A school-link student sends
 * `X-Respondent-Token` (LNK-04); anyone else signs in with Google and must have the respondent
 * role (staff try the flow as a preview that saves nothing). The token wins when both are sent.
 * Sets c.var.respondentKey. A well-formed token that matches no one is found out by the handler's
 * query, which then answers 401 or 404.
 */
export const respondent = createMiddleware<RespondentEnv>(async (c, next) => {
  const token = c.req.header(RESPONDENT_TOKEN_HEADER)
  if (token !== undefined) {
    if (!isRespondentToken(token)) throw new ApiError('unauthorized', UNKNOWN_TOKEN_MESSAGE)
    c.set('respondentKey', { tokenHash: await hashRespondentToken(token) })
  } else {
    const profile = await authenticate(c)
    if (profile.role !== 'respondent') throw new ApiError('forbidden')
    c.set('respondentKey', { profileId: profile.id })
  }
  await next()
})
