import { app } from './app'

// Worker entry. The scheduled (cron) handler is added in Stage 1.
export default {
  fetch: app.fetch,
}
