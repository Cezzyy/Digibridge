// Postgres answers a duplicate key with SQLSTATE 23505 and the constraint's name. postgres.js
// calls the name `constraint_name`, PGlite (the tests) `constraint`, and Drizzle wraps either
// in its own error with the driver's as `cause`.

const UNIQUE_VIOLATION = '23505'

type DriverError = { code?: unknown; constraint_name?: unknown; constraint?: unknown }

/** The unique constraint or index `err` broke, or undefined for any other error. */
export function uniqueViolation(err: unknown): string | undefined {
  for (let e: unknown = err; e && typeof e === 'object'; e = (e as { cause?: unknown }).cause) {
    const { code, constraint_name, constraint } = e as DriverError
    if (code !== UNIQUE_VIOLATION) continue
    const name = constraint_name ?? constraint
    return typeof name === 'string' ? name : ''
  }
  return undefined
}
