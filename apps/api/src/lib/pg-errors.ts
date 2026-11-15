// Postgres errors a handler turns into an answer. Postgres sends a SQLSTATE and the constraint or
// column it broke: postgres.js calls them `constraint_name` and `column_name`, PGlite (the tests)
// `constraint` and `column`, and Drizzle wraps either in its own error with the driver's as
// `cause`.

const UNIQUE_VIOLATION = '23505'
const NOT_NULL_VIOLATION = '23502'

type DriverError = {
  code?: unknown
  constraint_name?: unknown
  constraint?: unknown
  column_name?: unknown
  column?: unknown
}

/** The driver's error with SQLSTATE `code` inside `err`, if there is one. */
function driverError(err: unknown, code: string): DriverError | undefined {
  for (let e: unknown = err; e && typeof e === 'object'; e = (e as { cause?: unknown }).cause) {
    if ((e as DriverError).code === code) return e as DriverError
  }
  return undefined
}

const nameOf = (a: unknown, b: unknown) => {
  const name = a ?? b
  return typeof name === 'string' ? name : ''
}

/** The unique constraint or index `err` broke, or undefined for any other error. */
export function uniqueViolation(err: unknown): string | undefined {
  const e = driverError(err, UNIQUE_VIOLATION)
  return e && nameOf(e.constraint_name, e.constraint)
}

/** The column `err` left null against its NOT NULL, or undefined for any other error. */
export function notNullViolation(err: unknown): string | undefined {
  const e = driverError(err, NOT_NULL_VIOLATION)
  return e && nameOf(e.column_name, e.column)
}
