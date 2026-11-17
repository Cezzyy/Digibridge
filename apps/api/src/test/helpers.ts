// Test setup for the route tests: an in-memory Postgres with the real migrations, and
// Supabase-style access tokens signed with a test key. Shared requests and rows are in fixtures.ts.
// Don't import app here: setup.ts's mock of config/db imports this file.
import { choices, competencyAreas, profiles, questions, schema, schoolLinks } from '@digibridge/db'
import {
  AREA_CODES,
  AREA_LABELS,
  CHOICES_PER_QUESTION,
  DIFFICULTIES,
  ITEMS_PER_DIFFICULTY,
  LINK_CODE_LENGTH,
  type Role,
} from '@digibridge/shared'
import { PGlite } from '@electric-sql/pglite'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose'
import { fileURLToPath } from 'node:url'
import { vi } from 'vitest'
import type { RateLimit } from '@cloudflare/workers-types'
import type { Bindings } from '../env'

export const SUPABASE_URL = 'https://test-project.supabase.co'
export const WEB_ORIGIN = 'http://localhost:5173'
export const ADMIN_EMAIL = 'cez@aclc.test'
/** A rate limiter that lets everything through, and keeps the keys it was asked about. */
export function testLimiter(refuse: (key: string) => boolean = () => false) {
  const keys: string[] = []
  const limiter = {
    keys,
    limit: ({ key }: { key: string }) => {
      keys.push(key)
      return Promise.resolve({ success: !refuse(key) })
    },
  }
  return limiter as typeof limiter & RateLimit
}

const allowAll: RateLimit = testLimiter()

export const env = {
  SUPABASE_URL,
  WEB_ORIGIN,
  ADMIN_EMAILS: ` ${ADMIN_EMAIL} , other@aclc.test`,
  API_DOCS: 'true',
  API_IP_LIMIT: allowAll,
  LINK_OPEN_LIMIT: allowAll,
  LINK_JOIN_LIMIT: allowAll,
  STUDENT_NUMBER_LIMIT: allowAll,
  ANSWER_LIMIT: allowAll,
  RESPONDENT_ACTION_LIMIT: allowAll,
} as Bindings

// ---- Database ----

// setup.ts mocks config/db so every request uses this database.
export const testDb = drizzle(new PGlite(), { schema })

// .href: Node's URL type and the Workers one don't match.
const MIGRATIONS = fileURLToPath(new URL('../../../../supabase/migrations', import.meta.url).href)

let ready: Promise<void> | undefined

/**
 * Builds the database before a test file's tests. The route test files share a worker's module
 * graph (`isolate: false` in vitest.config.ts), so only the first call in each worker builds it.
 */
export function setUpDatabase() {
  ready ??= (async () => {
    // Supabase's auth.users, cut down to the column profiles.id references.
    await testDb.execute(sql`create schema auth`)
    await testDb.execute(sql`create table auth.users (id uuid primary key)`)
    await migrate(testDb, { migrationsFolder: MIGRATIONS })
  })()
  return ready
}

/**
 * Removes every account and everything that hangs off one (profiles, respondents, attempts), and
 * the school links.
 */
export async function clearAccounts() {
  await testDb.execute(sql`truncate auth.users, respondents, school_links cascade`)
}

/** The row Supabase creates in auth.users at Google sign-in, before our API sees the user. */
export async function addAuthUser(id = crypto.randomUUID()) {
  await testDb.execute(sql`insert into auth.users (id) values (${id})`)
  return id
}

/**
 * The 3 areas with exactly the items an attempt needs (4 basic, 4 intermediate, 2 advanced
 * each, every one with 4 choices and 1 correct), plus one inactive item per area and difficulty.
 */
export async function addQuestionBank() {
  const active: string[] = []
  const inactive: string[] = []
  for (const [sortOrder, code] of AREA_CODES.entries()) {
    const [area] = await testDb
      .insert(competencyAreas)
      .values({ code, name: AREA_LABELS[code], description: code, sortOrder })
      .returning({ id: competencyAreas.id })
    for (const difficulty of DIFFICULTIES) {
      for (let n = 0; n <= ITEMS_PER_DIFFICULTY[difficulty]; n++) {
        const isActive = n < ITEMS_PER_DIFFICULTY[difficulty]
        const [question] = await testDb
          .insert(questions)
          .values({ areaId: area!.id, difficulty, stem: `${code} ${difficulty} ${n}`, isActive })
          .returning({ id: questions.id })
        await testDb.insert(choices).values(
          Array.from({ length: CHOICES_PER_QUESTION }, (_, position) => ({
            questionId: question!.id,
            label: `Choice ${position + 1}`,
            isCorrect: position === 0,
            position,
          })),
        )
        ;(isActive ? active : inactive).push(question!.id)
      }
    }
  }
  return { active, inactive }
}

/** A school link, open for a day unless `values` says otherwise. clearAccounts removes it. */
export async function addSchoolLink(values: Partial<typeof schoolLinks.$inferInsert> = {}) {
  const [row] = await testDb
    .insert(schoolLinks)
    .values({
      code: crypto.randomUUID().replaceAll('-', '').slice(0, LINK_CODE_LENGTH).toUpperCase(),
      school: 'ACLC College of Mandaue',
      label: 'BSIT 2A',
      expiresAt: new Date(Date.now() + 86_400_000),
      ...values,
    })
    .returning()
  return row!
}

/** Removes the areas, questions and choices that addQuestionBank added. */
export async function clearQuestionBank() {
  await testDb.execute(sql`truncate competency_areas, questions, choices cascade`)
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
  // The same sign-in time on the profile and the token, so the API never takes the token for a
  // newer Google sign-in (as it would if a second ticked over between the two).
  const signedInAt = Math.floor(Date.now() / 1000)
  await testDb
    .insert(profiles)
    .values({ id, email, role, lastSignInAt: new Date(signedInAt * 1000) })
  return { id, email, headers: bearer(await tokenFor(id, { email, signedInAt })) }
}
