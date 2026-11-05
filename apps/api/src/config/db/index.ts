// Database connection: Hyperdrive binding, postgres.js client, drizzle() instance.
import { schema } from '@digibridge/db'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import type { Bindings } from '../../env'

// Call once per request: a Worker can't reuse a socket across requests, and Hyperdrive
// keeps the real connections to Postgres warm, so opening a client here is cheap.
export function createDb(env: Pick<Bindings, 'HYPERDRIVE'>) {
  const client = postgres(env.HYPERDRIVE.connectionString, {
    // Hyperdrive's recommended cap for one Worker invocation.
    max: 5,
    // Skip the type lookup on connect; the schema uses only built-in array types.
    fetch_types: false,
  })
  return drizzle(client, { schema })
}

export type Db = ReturnType<typeof createDb>
