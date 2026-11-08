import type { ExecutionContext, ScheduledController } from '@cloudflare/workers-types'
import { app } from './app'
import { createDb } from './config/db'
import type { Bindings } from './env'
import { closeExpiredAttempts } from './lib/close-attempt'

// Worker entry: the API, and the cron trigger in wrangler.toml.
export default {
  fetch: app.fetch,

  // Every 5 minutes: closes attempts nobody submitted (the tab was closed, the phone died) once
  // they're past expires_at plus the grace period, so their results exist.
  scheduled(_controller: ScheduledController, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(
      closeExpiredAttempts(createDb(env)).then((closed) => {
        if (closed > 0) console.log(`Closed ${closed} expired attempt(s)`)
      }),
    )
  },
}
