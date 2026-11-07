import { createMiddleware } from 'hono/factory'
import { createDb } from '../config/db'
import type { AppEnv } from '../env'

// One database client per request (see config/db). postgres.js connects on the first
// query, so routes that never query, like /health, open no connection.
export const dbMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  c.set('db', createDb(c.env))
  await next()
})
