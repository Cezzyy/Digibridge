import type { VoidAttempt } from '@digibridge/shared'
import { ref } from 'vue'
import { api, ApiRequestError, call, messageOf } from '../lib/api'

/**
 * An admin voiding a respondent's attempt or deleting the respondent (USR-03). Each resolves to
 * true once it's done, and leaves its error in words otherwise. Another admin having done the
 * same first counts as done: an attempt already voided (409), a respondent already gone (404).
 */
export function useRespondentActions() {
  const voiding = ref(false)
  const voidError = ref<string | null>(null)
  const deleting = ref(false)
  const deleteError = ref<string | null>(null)

  async function voidAttempt(attemptId: string, input: VoidAttempt) {
    voiding.value = true
    voidError.value = null
    try {
      await call(api.admin.attempts[':id'].void.$post({ param: { id: attemptId }, json: input }))
      return true
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'conflict') return true
      voidError.value = messageOf(err)
      return false
    } finally {
      voiding.value = false
    }
  }

  async function deleteRespondent(respondentId: string) {
    deleting.value = true
    deleteError.value = null
    try {
      await call(api.admin.respondents[':id'].$delete({ param: { id: respondentId } }))
      return true
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'not_found') return true
      deleteError.value = messageOf(err)
      return false
    } finally {
      deleting.value = false
    }
  }

  /** Clears both errors, for a dialog opened again. */
  function reset() {
    voidError.value = null
    deleteError.value = null
  }

  return { voiding, voidError, voidAttempt, deleting, deleteError, deleteRespondent, reset }
}
