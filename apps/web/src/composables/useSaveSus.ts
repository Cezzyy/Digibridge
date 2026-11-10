import type { SusAnswers } from '@digibridge/shared'
import { ref } from 'vue'
import { api, ApiRequestError, call, messageOf } from '../lib/api'

/**
 * Sends the usability survey for a closed attempt (SUS-01, SUS-04). `save` resolves true once the
 * attempt has a survey: just saved, or saved earlier (409, e.g. from another tab). Otherwise
 * `error` says why, in words for students. The score stays with the research team.
 */
export function useSaveSus() {
  const saving = ref(false)
  const error = ref<string | null>(null)

  async function save(attemptId: string, answers: SusAnswers) {
    saving.value = true
    error.value = null
    try {
      await call(api.attempts[':id'].sus.$post({ param: { id: attemptId }, json: { answers } }))
      return true
    } catch (err) {
      // The results page only shows a closed attempt, so a conflict here means it's answered.
      if (err instanceof ApiRequestError && err.code === 'conflict') return true
      error.value = messageOf(err)
      return false
    } finally {
      saving.value = false
    }
  }

  return { save, saving, error }
}
