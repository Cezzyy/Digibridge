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

// The signed-in user's Google token; getSession refreshes it first if it has expired.
async function googleHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const client = (headers: () => Promise<Record<string, string>>) =>
  hc<AppType>(import.meta.env.VITE_API_URL, { fetch: fetchWithTimeout, headers }).api.v1

/** A typed client for /api/v1, built from the API's route types. */
export type Api = ReturnType<typeof client>

/** Sends the signed-in user's Google token, if there is one. */
export const api: Api = client(googleHeaders)

/**
 * For a school-link student: sends their respondent token (`X-Respondent-Token`), or nothing
 * before they've joined, and never the Google token, so a browser that is also signed in with
 * Google stays apart. Each call picks its client (`useRespondentFlow().client()`), so a call
 * keeps its sign-in even if the page changes before it's sent, as a retry can.
 */
export function schoolApi(token: string | null): Api {
  const headers: Record<string, string> = token ? { [RESPONDENT_TOKEN_HEADER]: token } : {}
  return client(async () => headers)
}

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
  // 204 No Content (a delete) has no body to read.
  if (res.status === 204) return undefined as SuccessBody<R>
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
