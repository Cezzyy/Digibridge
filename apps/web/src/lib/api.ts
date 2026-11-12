import { RESPONDENT_TOKEN_HEADER, type ErrorCode } from '@digibridge/shared'
import type { AppType } from 'api/src/app'
import { hc, type ClientResponse } from 'hono/client'
import { supabase } from './supabase'

/** A request with no reply by then is given up on, and fails as `network`. */
const REQUEST_TIMEOUT_MS = 10_000

// Browsers never time out a fetch by themselves: on a bad connection it can hang for minutes.
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout
  return fetch(input, { ...init, signal })
}

// The school-link student's respondent token while a school-link page is open (set by
// stores/schoolLink.ts, which the router keeps in step with the page). Calls then send it in
// place of the Google sign-in, so a browser that is also signed in with Google stays apart.
let respondentToken: string | null = null

/** Sends `X-Respondent-Token` instead of the Google token on every call, or stops with null. */
export function setRespondentToken(token: string | null) {
  respondentToken = token
}

// Typed client for /api/v1, built from the API's route types. Each call sends the
// signed-in user's token; getSession refreshes it first if it has expired. On school-link pages
// it sends the respondent token instead.
export const api = hc<AppType>(import.meta.env.VITE_API_URL, {
  fetch: fetchWithTimeout,
  headers: async (): Promise<Record<string, string>> => {
    if (respondentToken !== null) return { [RESPONDENT_TOKEN_HEADER]: respondentToken }
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  },
}).api.v1

/** An error from the API ({ error: { code, message } }), or `network` when it couldn't be reached. */
export class ApiRequestError extends Error {
  readonly code: ErrorCode | 'network'
  readonly status: number

  constructor(code: ErrorCode | 'network', message: string, status: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.code = code
    this.status = status
  }
}

const NETWORK_MESSAGE =
  "We couldn't reach DigiBridge. Check your internet connection and try again."
const FALLBACK_MESSAGE = 'Something went wrong on our side. Please try again.'

/** For an error that isn't from the API (a bug, or something the browser threw). */
export const SOMETHING_WENT_WRONG = 'Something went wrong. Please try again.'

/** What to tell the student about a failed call: the API's message, or SOMETHING_WENT_WRONG. */
export const messageOf = (err: unknown) =>
  err instanceof ApiRequestError ? err.message : SOMETHING_WENT_WRONG

// The JSON body of a call's successful responses.
type SuccessBody<R> =
  R extends ClientResponse<infer T, infer S, 'json'>
    ? S extends 200 | 201 | 204
      ? T
      : never
    : never

/**
 * Awaits an API call and returns its JSON body, or throws ApiRequestError.
 * `const me = await call(api.me.$get())`
 */
export async function call<R extends ClientResponse<unknown, number, string>>(
  request: Promise<R>,
): Promise<SuccessBody<R>> {
  let res: R
  try {
    res = await request
  } catch {
    throw new ApiRequestError('network', NETWORK_MESSAGE, 0)
  }
  if (res.ok) return (await res.json()) as SuccessBody<R>

  const body = (await res.json().catch(() => null)) as {
    error?: { code?: ErrorCode; message?: string }
  } | null
  throw new ApiRequestError(
    body?.error?.code ?? 'internal_error',
    body?.error?.message ?? FALLBACK_MESSAGE,
    res.status,
  )
}
