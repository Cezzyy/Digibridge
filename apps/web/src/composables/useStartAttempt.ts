import type { InferResponseType } from 'hono/client'
import { ref } from 'vue'
import { api, ApiRequestError, call } from '../lib/api'
import { useSessionStore } from '../stores/session'

export type AttemptSummary = InferResponseType<typeof api.attempts.$post, 200 | 201>

/**
 * Starts the assessment, or gets the attempt already in progress (ASM-01, ASM-07).
 * `start` resolves to the attempt, or null with `error` set in words for students. A 409 means
 * the account's state changed (no profile, already taken, or not ready), so /me is loaded again
 * and the page can follow it.
 */
export function useStartAttempt() {
  const session = useSessionStore()
  const starting = ref(false)
  const error = ref<string | null>(null)

  async function start(): Promise<AttemptSummary | null> {
    starting.value = true
    error.value = null
    try {
      const attempt = await call(api.attempts.$post())
      session.setAttempt({ id: attempt.id, status: attempt.status })
      return attempt
    } catch (err) {
      error.value =
        err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.'
      if (err instanceof ApiRequestError && err.code === 'conflict') await session.loadMe()
      return null
    } finally {
      starting.value = false
    }
  }

  return { start, starting, error }
}
