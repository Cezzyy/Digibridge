import type { InferResponseType } from 'hono/client'
import { ref } from 'vue'
import { api, ApiRequestError, call, messageOf } from '../lib/api'
import { useSessionStore } from '../stores/session'

export type AttemptResult = InferResponseType<(typeof api.attempts)[':id']['result']['$get'], 200>
export type AreaResult = AttemptResult['areas'][number]
export type LessonPick = AreaResult['lessons'][number]

/**
 * The signed-in respondent's result: scores, levels and lessons (RES-01, RES-02). `load`
 * resolves to `moved` when the attempt is no longer theirs to show (voided by the team, or the
 * account changed); /me is loaded again then, so the page can follow it. If /me fails, it
 * resolves to `failed` and the session's error screen shows. Other failures set `error` in words
 * for students.
 */
export function useResult() {
  const session = useSessionStore()
  const result = ref<AttemptResult | null>(null)
  const error = ref<string | null>(null)

  // When /me failed, App.vue shows the error screen over this page, so stay: following an empty
  // `me` home would end on the sign-in page, and moving pages closes the error screen.
  const movedUnlessFailed = () => (session.failure ? 'failed' : 'moved')

  async function load(): Promise<'ok' | 'moved' | 'failed'> {
    error.value = null
    const id = session.me?.attempt?.id
    if (!id) return movedUnlessFailed()
    try {
      result.value = await call(api.attempts[':id'].result.$get({ param: { id } }))
      return 'ok'
    } catch (err) {
      if (
        err instanceof ApiRequestError &&
        ['conflict', 'not_found', 'forbidden'].includes(err.code)
      ) {
        await session.loadMe()
        return movedUnlessFailed()
      }
      error.value = messageOf(err)
      return 'failed'
    }
  }

  return { result, error, load }
}
