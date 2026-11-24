import type { InferResponseType } from 'hono/client'
import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
import { api, call } from '../lib/api'

export type PreviewAttempt = InferResponseType<typeof api.preview.attempts.$post, 201>
export type PreviewResult = InferResponseType<typeof api.preview.result.$post, 200>
type Status = PreviewAttempt['status'] | PreviewResult['status']

/** Which preview: a staff account's, online or through one school link. */
export const previewScope = (profileId: string, code: string | null) =>
  `${profileId}:${code ?? 'online'}`

type Preview = {
  scope: string
  /** The profile form was checked: home shows Start, as it does once a student's is saved. */
  profileDone: boolean
  attempt: PreviewAttempt | null
  status: Status | null
  result: PreviewResult | null
  susAnswered: boolean
}

/**
 * Staff trying the student steps, online or through a link (PRD "Home"). The API builds a sample
 * assessment and scores it, but saves nothing, so staff tries stay out of the research data and
 * off a link's limit. Everything else lives here, in memory only: a reload starts the preview
 * over. One preview at a time; one for another account or link replaces it.
 */
export const usePreviewStore = defineStore('preview', () => {
  const preview = shallowRef<Preview | null>(null)

  /** The preview for this scope, if it's the one held. */
  const of = (scope: string) => (preview.value?.scope === scope ? preview.value : null)
  const update = (scope: string, patch: Partial<Preview>) => {
    const current = of(scope) ?? {
      scope,
      profileDone: false,
      attempt: null,
      status: null,
      result: null,
      susAnswered: false,
    }
    preview.value = { ...current, ...patch }
  }

  /** The attempt as /me or the link would give it: its ID and status. */
  function attemptFor(scope: string) {
    const held = of(scope)
    return held?.attempt && held.status ? { id: held.attempt.id, status: held.status } : null
  }

  const profileDone = (scope: string) => of(scope)?.profileDone ?? false

  function finishProfile(scope: string) {
    update(scope, { profileDone: true })
  }

  /** Gets a sample assessment, or the one in progress. Throws ApiRequestError. */
  async function start(scope: string) {
    const held = of(scope)
    if (held?.attempt && held.status === 'in_progress') return held.attempt
    const attempt = await call(api.preview.attempts.$post())
    update(scope, { attempt, status: attempt.status, result: null, susAnswered: false })
    return attempt
  }

  /** Scores the answers on the server, which saves nothing. Throws ApiRequestError. */
  async function submit(scope: string, answers: Record<string, string>, timeUp: boolean) {
    const attempt = of(scope)?.attempt
    if (!attempt) return null
    const questionIds = attempt.items.map((item) => item.id)
    const result = await call(
      api.preview.result.$post({
        json: {
          id: attempt.id,
          questionIds,
          answers: questionIds.flatMap((questionId) => {
            const choiceId = answers[questionId]
            return choiceId ? [{ questionId, choiceId }] : []
          }),
          timeUp,
        },
      }),
    )
    update(scope, { status: result.status, result })
    return result
  }

  function rate(scope: string) {
    update(scope, { susAnswered: true })
  }

  /** Ends the preview, so the next one starts from the notice. */
  function clear() {
    preview.value = null
  }

  return {
    of,
    attemptFor,
    profileDone,
    finishProfile,
    start,
    submit,
    rate,
    clear,
  }
})
