import { RESPONDENT_TOKEN_HEADER } from '@digibridge/shared'
import type { Context } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from '../env'

// Only the web app may call the API from a browser: the Pages URL in production,
// the Vite dev server locally (WEB_ORIGIN in .dev.vars). School-link students send their
// respondent token in its own header instead of Authorization. Retry-After is exposed so the web
// app can wait out a rate limit before saving an answer again.
export const corsMiddleware = cors({
  origin: (origin, c: Context<AppEnv>) => (origin === c.env.WEB_ORIGIN ? origin : null),
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowHeaders: ['Authorization', 'Content-Type', RESPONDENT_TOKEN_HEADER],
  exposeHeaders: ['Retry-After'],
  maxAge: 86400,
})
