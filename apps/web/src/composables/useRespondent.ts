import type { InferResponseType } from 'hono/client'
import { ref } from 'vue'
import { api, ApiRequestError, call, messageOf } from '../lib/api'

export type RespondentDetail = InferResponseType<(typeof api.admin.respondents)[':id']['$get'], 200>
export type AnsweredItem = NonNullable<NonNullable<RespondentDetail['attempt']>['answers']>[number]

/**
 * One respondent's profile, area scores and SUS answers, plus the answer sheet for admins
 * (DSH-05, DSH-07). `notFound` is set when they're gone (deleted, or a stale link). Only the
 * latest load counts, so moving down the table quickly never shows the one before.
 */
export function useRespondent() {
  const detail = ref<RespondentDetail | null>(null)
  const notFound = ref(false)
  const error = ref<string | null>(null)
  let latest = 0

  async function load(id: string) {
    const request = ++latest
    detail.value = null
    notFound.value = false
    error.value = null
    try {
      const found = await call(api.admin.respondents[':id'].$get({ param: { id } }))
      if (request === latest) detail.value = found
    } catch (err) {
      if (request !== latest) return
      if (err instanceof ApiRequestError && err.code === 'not_found') notFound.value = true
      else error.value = messageOf(err)
    }
  }

  return { detail, notFound, error, load }
}
