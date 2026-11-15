// Runs before every route test file (the `routes` project in vitest.config.ts).
import { afterEach, beforeAll, vi } from 'vitest'
import { clearAccounts, serveTestJwks, setUpDatabase } from './helpers'

// Every request gets the in-memory test database instead of Hyperdrive.
vi.mock('../config/db', async () => {
  const { testDb } = await import('./helpers')
  return { createDb: () => testDb }
})

// Starting PGlite and running the migrations takes a few seconds, more when
// `pnpm check` runs every package at once, so allow longer than the 10 s default.
beforeAll(async () => {
  await setUpDatabase()
  serveTestJwks()
}, 60_000)
afterEach(clearAccounts)
