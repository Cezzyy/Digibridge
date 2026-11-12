// Imported, not global: the web app type-checks this file too (for AppType) without Worker globals.
import type { Hyperdrive, R2Bucket } from '@cloudflare/workers-types'
import type { Profile } from '@digibridge/db'
import type { Db } from './config/db'

// Worker environment: [vars], bindings and secrets from wrangler.toml; .dev.vars overrides locally.
export type Bindings = {
  SUPABASE_URL: string
  ADMIN_EMAILS: string
  WEB_ORIGIN: string
  HYPERDRIVE: Hyperdrive
  MEDIA: R2Bucket
}

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
