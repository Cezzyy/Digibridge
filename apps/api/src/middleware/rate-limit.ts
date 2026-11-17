import { studentNumberSchema } from '@digibridge/shared'
import type { Context, Env } from 'hono'
import { createMiddleware } from 'hono/factory'
import type { AppEnv, AuthEnv, Bindings, RateLimiterName, RespondentEnv } from '../env'
import { sha256Hex } from '../lib/hash'
import { ipKey } from '../lib/ip-key'
import { ApiError } from './error'

// Rate limits through the Workers Rate Limiting binding ([[ratelimits]] in wrangler.toml, where the
// numbers are). A request over a limit gets 429 `rate_limited` with Retry-After; the web app retries
// answer saves by itself and shows the message elsewhere.

/** Every limiter counts over a minute, so that's the longest anyone has to wait. */
export const RATE_LIMIT_RETRY_AFTER_SECONDS = 60

/** Who a request counts against; undefined skips the limit (the request fails its checks next). */
type KeyOf<E extends Env> = (c: Context<E>) => string | undefined | Promise<string | undefined>

/** Counts the request against `limiter` under the key `keyOf` gives, and refuses it once over. */
export function rateLimit<E extends AppEnv = AppEnv>(limiter: RateLimiterName, keyOf: KeyOf<E>) {
  return createMiddleware<E>(async (c, next) => {
    const key = await keyOf(c)
    if (key !== undefined) {
      const { success } = await (c.env as Bindings)[limiter].limit({ key })
      if (!success) {
        c.header('Retry-After', String(RATE_LIMIT_RETRY_AFTER_SECONDS))
        throw new ApiError('rate_limited')
      }
    }
    await next()
  })
}

/**
 * The caller's IP, set by Cloudflare, with IPv6 counted per /64 (`ipKey`), since one user can
 * pick a new address from theirs for every request. A school lab often shares one IP, which is why
 * the per-IP limits are high. Without the header (tests), every request shares one key.
 */
export const clientIp = (c: Context) => ipKey(c.req.header('CF-Connecting-IP') ?? 'unknown')

/** The respondent a request is for, after the `respondent` middleware. */
const respondentOf = (c: Context<RespondentEnv>) => {
  const key = c.var.respondentKey
  return 'tokenHash' in key ? `token:${key.tokenHash}` : `profile:${key.profileId}`
}

/**
 * The caller's IP and the student number in a join request's body, hashed so it never reaches the
 * counters as is. Per IP, so nobody elsewhere can use up a student's tries by sending their number.
 * Hono keeps the parsed body, so the route's validator reads it again for free. A body that isn't
 * JSON or has no valid number isn't counted: the validator refuses it before any database work.
 */
const studentNumberOf = async (c: Context) => {
  const body: unknown = await c.req.json().catch(() => undefined)
  if (typeof body !== 'object' || body === null || !('studentNumber' in body)) return undefined
  const parsed = studentNumberSchema.safeParse(body.studentNumber)
  return parsed.success ? `${clientIp(c)}|${await sha256Hex(parsed.data)}` : undefined
}

/** Every /api/v1 request, per IP: a catch-all. */
export const apiRateLimit = rateLimit('API_IP_LIMIT', clientIp)

/** Opening a school link, per IP. */
export const linkOpenLimit = rateLimit('LINK_OPEN_LIMIT', clientIp)

/** Joining a school link, per IP. */
export const linkJoinLimit = rateLimit('LINK_JOIN_LIMIT', clientIp)

/** Joining a school link, per IP and student number, across all links. */
export const studentNumberLimit = rateLimit('STUDENT_NUMBER_LIMIT', studentNumberOf)

/**
 * Answer saves, per respondent. Goes after `respondent`. There's no per-IP limit of its own: a lab
 * shares one IP, so one student flooding it would block every classmate's saves, and a made-up
 * token costs only one indexed lookup that saves nothing, which the catch-all already caps.
 */
export const answerLimit = rateLimit<RespondentEnv>('ANSWER_LIMIT', respondentOf)

/** One of a respondent's actions (start, submit, SUS), per respondent. Goes after `respondent`. */
export const respondentActionLimit = (action: string) =>
  rateLimit<RespondentEnv>('RESPONDENT_ACTION_LIMIT', (c) => `${action}:${respondentOf(c)}`)

/** One of a signed-in user's actions (the online profile), per account. Goes after `auth`. */
export const accountActionLimit = (action: string) =>
  rateLimit<AuthEnv>('RESPONDENT_ACTION_LIMIT', (c) => `${action}:profile:${c.var.profile.id}`)
