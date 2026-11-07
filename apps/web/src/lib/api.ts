import type { ErrorCode } from '@digibridge/shared'
import type { AppType } from 'api/src/app'
import { hc, type ClientResponse } from 'hono/client'
import { supabase } from './supabase'

// Typed client for /api/v1, built from the API's route types. Each call sends the
// signed-in user's token; getSession refreshes it first if it has expired.
export const api = hc<AppType>(import.meta.env.VITE_API_URL, {
  headers: async (): Promise<Record<string, string>> => {
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
