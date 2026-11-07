import type { Role } from '@digibridge/shared'
import { createMiddleware } from 'hono/factory'
import { z } from '@hono/zod-openapi'
import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose'
import type { AuthEnv } from '../env'
import { loadProfile, type TokenUser } from '../lib/profile'
import { ApiError } from './error'

// Supabase signs access tokens with the project's ES256 keys, published as a JWKS.
// One key set per Supabase URL, kept for the life of the Worker isolate: jose caches
// the keys and refetches only when it meets a key ID it doesn't know.
const keySets = new Map<string, JWTVerifyGetKey>()

function keySetFor(supabaseUrl: string) {
  let keySet = keySets.get(supabaseUrl)
  if (!keySet) {
    keySet = createRemoteJWKSet(new URL('/auth/v1/.well-known/jwks.json', supabaseUrl))
    keySets.set(supabaseUrl, keySet)
  }
  return keySet
}

// The claims we use from a Supabase access token. Google fills user_metadata.
const ClaimsSchema = z.object({
  sub: z.uuid(),
  email: z.email(),
  iat: z.number(),
  // How and when the user signed in: [{ method: 'oauth', timestamp: <seconds> }].
  amr: z.array(z.object({ method: z.string(), timestamp: z.number() })).optional(),
  user_metadata: z
    .object({
      email_verified: z.boolean().optional(),
      full_name: z.string().optional(),
      name: z.string().optional(),
      avatar_url: z.string().optional(),
      picture: z.string().optional(),
    })
    .optional(),
})

const EXPIRED_MESSAGE = 'Your sign-in has expired. Please sign in again.'

async function verifiedPayload(token: string, supabaseUrl: string) {
  try {
    const { payload } = await jwtVerify(token, keySetFor(supabaseUrl), {
      issuer: new URL('/auth/v1', supabaseUrl).href,
      audience: 'authenticated',
      algorithms: ['ES256'],
    })
    return payload
  } catch (err) {
    // A bad, expired or foreign token is the caller's problem. Not reaching the JWKS is ours.
    if (err instanceof errors.JWTExpired) throw new ApiError('unauthorized', EXPIRED_MESSAGE)
    if (err instanceof errors.JOSEError && !(err instanceof errors.JWKSTimeout)) {
      throw new ApiError('unauthorized')
    }
    throw err
  }
}

async function verifyToken(token: string, supabaseUrl: string): Promise<TokenUser> {
  const claims = ClaimsSchema.safeParse(await verifiedPayload(token, supabaseUrl))
  if (!claims.success) throw new ApiError('unauthorized')
  const { sub, email, iat, amr, user_metadata: meta } = claims.data

  const signedInAt = Math.max(...(amr ?? []).map((a) => a.timestamp), 0) || iat
  return {
    id: sub,
    email,
    emailVerified: meta?.email_verified === true,
    fullName: meta?.full_name ?? meta?.name ?? null,
    avatarUrl: meta?.avatar_url ?? meta?.picture ?? null,
    signedInAt: new Date(signedInAt * 1000),
  }
}

/**
 * Requires `Authorization: Bearer <Supabase access token>`, verifies it and sets
 * c.var.profile, creating the profile on the user's first call (AUTH-01, AUTH-02).
 */
export const auth = createMiddleware<AuthEnv>(async (c, next) => {
  const header = c.req.header('Authorization')
  const token = header?.match(/^Bearer (\S+)$/i)?.[1]
  if (!token) throw new ApiError('unauthorized')

  const user = await verifyToken(token, c.env.SUPABASE_URL)
  c.set('profile', await loadProfile(c.var.db, user, c.env.ADMIN_EMAILS))
  await next()
})

/**
 * Blocks roles not in the list with 403 (AUTH-04). Put it after `auth`:
 * `middleware: [auth, requireRole(...STAFF_ROLES)] as const`.
 */
export function requireRole(...roles: Role[]) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    if (!roles.includes(c.var.profile.role)) throw new ApiError('forbidden')
    await next()
  })
}
