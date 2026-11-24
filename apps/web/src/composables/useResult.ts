import type { InferResponseType } from 'hono/client'
import { ref } from 'vue'
import type { api } from '../lib/api'
import { ApiRequestError, call, messageOf } from '../lib/api'
import { usePreviewStore } from '../stores/preview'
import { useRespondentFlow } from './useRespondentFlow'

export type AttemptResult = InferResponseType<(typeof api.attempts)[':id']['result']['$get'], 200>
export type AreaResult = AttemptResult['areas'][number]
export type LessonPick = AreaResult['lessons'][number]

/**
 * The respondent's result, online or through a school link: scores, levels and lessons (RES-01,
 * RES-02). `load` resolves to `moved` when the attempt is no longer theirs to show (voided by the
 * team, or the account changed); their state (/me, or the link) is loaded again then, so the
 * page can follow it. If that fails, it resolves to `failed` and App.vue's error screen shows.
 * Other failures set `error` in words for students. A staff preview's result is already in the
 * preview store.
 */
export function useResult() {
  const flow = useRespondentFlow()
  const previews = usePreviewStore()
  const result = ref<AttemptResult | null>(null)
  const error = ref<string | null>(null)

  // When reloading failed, App.vue shows the error screen over this page, so stay: following an
  // empty state home would end on the sign-in page, and moving pages closes the error screen.
  const movedUnlessFailed = () => (flow.failed.value ? 'failed' : 'moved')

  async function load(): Promise<'ok' | 'moved' | 'failed'> {
    error.value = null
    const key = flow.previewKey.value
    if (key) {
      const held = previews.of(key)
      if (!held?.result) return 'moved'
      result.value = { ...held.result, susAnswered: held.susAnswered }
      return 'ok'
    }
    const id = flow.attempt.value?.id
    if (!id) return movedUnlessFailed()
    try {
      result.value = await call(flow.client().attempts[':id'].result.$get({ param: { id } }))
      return 'ok'
    } catch (err) {
      if (
        err instanceof ApiRequestError &&
        ['conflict', 'not_found', 'forbidden'].includes(err.code)
      ) {
        await flow.reload()
        return movedUnlessFailed()
      }
      error.value = messageOf(err)
      return 'failed'
    }
  }

  return { result, error, load }
}
