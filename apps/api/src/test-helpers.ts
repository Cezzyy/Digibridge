// Test setup for app.test.ts: an in-memory Postgres with the real migrations, and
// Supabase-style access tokens signed with a test key.
// Don't import app here: app.test.ts's mock of config/db imports this file.
import { profiles, schema } from '@digibridge/db'
import type { Role } from '@digibridge/shared'
import { PGlite } from '@electric-sql/pglite'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose'
import { fileURLToPath } from 'node:url'
import { vi } from 'vitest'
import type { Bindings } from './env'

export const SUPABASE_URL = 'https://test-project.supabase.co'
export const WEB_ORIGIN = 'http://localhost:5173'
export const ADMIN_EMAIL = 'cez@aclc.test'
export const env = {
  SUPABASE_URL,
  WEB_ORIGIN,
  ADMIN_EMAILS: ` ${ADMIN_EMAIL} , other@aclc.test`,
} as Bindings

// ---- Database ----

// app.test.ts mocks config/db so every request uses this database.
export const testDb = drizzle(new PGlite(), { schema })

// .href: Node's URL type and the Workers one don't match.
const MIGRATIONS = fileURLToPath(new URL('../../../supabase/migrations', import.meta.url).href)

/** Run once per test file, before the tests. */
export async function setUpDatabase() {
  // Supabase's auth.users, cut down to the column profiles.id references.
  await testDb.execute(sql`create schema auth`)
  await testDb.execute(sql`create table auth.users (id uuid primary key)`)
  await migrate(testDb, { migrationsFolder: MIGRATIONS })
}

/** Removes every account and everything that hangs off one (profiles, respondents, attempts). */
export async function clearAccounts() {
  await testDb.execute(sql`truncate auth.users, respondents cascade`)
}

/** The row Supabase creates in auth.users at Google sign-in, before our API sees the user. */
export async function addAuthUser(id = crypto.randomUUID()) {
  await testDb.execute(sql`insert into auth.users (id) values (${id})`)
  return id
}

// ---- Tokens ----

const KEY_ID = 'test-key'
const keys = await generateKeyPair('ES256')
const publicJwk = { ...(await exportJWK(keys.publicKey)), kid: KEY_ID, alg: 'ES256', use: 'sig' }

/** jose fetches the project's JWKS; answer with the test key instead of calling Supabase. */
export function serveTestJwks() {
  const jwksUrl = `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: URL | RequestInfo) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url === jwksUrl) return Response.json({ keys: [publicJwk] })
      throw new Error(`Unexpected fetch in a test: ${url}`)
    }),
  )
}

export type TokenOptions = {
  email?: string
  emailVerified?: boolean
  fullName?: string
  avatarUrl?: string
  /** Seconds since 1970 when the user signed in with Google. Default: now. */
  signedInAt?: number
  expiresAt?: number | string
  issuer?: string
  key?: CryptoKey
}

/** An access token shaped like the ones Supabase issues after Google sign-in. */
export async function tokenFor(userId: string, options: TokenOptions = {}) {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({
    email: options.email ?? `${userId.slice(0, 8)}@aclc.test`,
    role: 'authenticated',
    amr: [{ method: 'oauth', timestamp: options.signedInAt ?? now }],
    user_metadata: {
      email_verified: options.emailVerified ?? true,
      full_name: options.fullName ?? 'Juan Dela Cruz',
      avatar_url: options.avatarUrl ?? 'https://lh3.googleusercontent.com/a/test',
    },
  })
    .setProtectedHeader({ alg: 'ES256', kid: KEY_ID })
    .setSubject(userId)
    .setIssuer(options.issuer ?? `${SUPABASE_URL}/auth/v1`)
    .setAudience('authenticated')
    .setIssuedAt(now)
    .setExpirationTime(options.expiresAt ?? now + 3600)
    .sign(options.key ?? keys.privateKey)
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

/** A user who has already signed in once, with the given role. */
export async function signedIn(role: Role = 'respondent') {
  const id = await addAuthUser()
  const email = `${role}-${id.slice(0, 8)}@aclc.test`
  await testDb.insert(profiles).values({ id, email, role })
  return { id, email, headers: bearer(await tokenFor(id, { email })) }
}
