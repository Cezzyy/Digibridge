import type { Context } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from '../env'

// Only the web app may call the API from a browser: the Pages URL in production,
// the Vite dev server locally (WEB_ORIGIN in .dev.vars).
export const corsMiddleware = cors({
  origin: (origin, c: Context<AppEnv>) => (origin === c.env.WEB_ORIGIN ? origin : null),
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowHeaders: ['Authorization', 'Content-Type', 'X-Kiosk-Session'],
  maxAge: 86400,
})
