// Imported, not global: the web app type-checks this file too (for AppType) without Worker globals.
import type { Hyperdrive, R2Bucket, RateLimit } from '@cloudflare/workers-types'
import type { Profile } from '@digibridge/db'
import type { Db } from './config/db'

// Worker environment: [vars], bindings and secrets from wrangler.toml; .dev.vars overrides locally.
export type Bindings = {
  SUPABASE_URL: string
  ADMIN_EMAILS: string
  WEB_ORIGIN: string
  HYPERDRIVE: Hyperdrive
  MEDIA: R2Bucket
  // Rate limiters ([[ratelimits]] in wrangler.toml, used by middleware/rate-limit.ts).
  API_IP_LIMIT: RateLimit
  LINK_OPEN_LIMIT: RateLimit
  LINK_JOIN_LIMIT: RateLimit
  STUDENT_NUMBER_LIMIT: RateLimit
  ANSWER_LIMIT: RateLimit
  ANSWER_IP_LIMIT: RateLimit
  RESPONDENT_ACTION_LIMIT: RateLimit
}

/** The name of a rate limiter binding. */
export type RateLimiterName = {
  [K in keyof Bindings]: Bindings[K] extends RateLimit ? K : never
}[keyof Bindings]

// c.var.db is set for every /api/v1 request (middleware/db.ts).
export type AppEnv = { Bindings: Bindings; Variables: { db: Db } }

// Routes with the auth middleware also get the signed-in user's profile.
export type AuthEnv = AppEnv & { Variables: { profile: Profile } }

/**
 * Who a respondent route is for: an online respondent by their Google account, or a school-link
 * student by the hash of the token their browser sends (LNK-04). See `respondentIs`.
 */
export type RespondentKey = { profileId: string } | { tokenHash: string }

// Routes with the respondent middleware get the caller's key; the row itself is looked up by the
// handler's own query, so this costs no extra round trip.
export type RespondentEnv = AppEnv & { Variables: { respondentKey: RespondentKey } }
