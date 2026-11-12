import type { InferResponseType } from 'hono/client'
import { ref } from 'vue'
import { api, ApiRequestError, call, messageOf } from '../lib/api'
import { useRespondentFlow } from './useRespondentFlow'

export type AttemptSummary = InferResponseType<typeof api.attempts.$post, 200 | 201>

/**
 * Starts the assessment, or gets the attempt already in progress (ASM-01, ASM-07), online or
 * through a school link. `start` resolves to the attempt, or null with `error` set in words for
 * students. A 409 means the student's state changed (no profile, already taken, or not ready), so
 * it's loaded again (/me, or the link) and the page can follow it.
 */
export function useStartAttempt() {
  const flow = useRespondentFlow()
  const starting = ref(false)
  const error = ref<string | null>(null)

  async function start(): Promise<AttemptSummary | null> {
    starting.value = true
    error.value = null
    try {
      const attempt = await call(api.attempts.$post())
      flow.setAttempt({ id: attempt.id, status: attempt.status })
      return attempt
    } catch (err) {
      error.value = messageOf(err)
      if (err instanceof ApiRequestError && err.code === 'conflict') await flow.reload()
      return null
    } finally {
      starting.value = false
    }
  }

  return { start, starting, error }
}
