import type { OnlineRespondentInput } from '@digibridge/shared'
import { ref } from 'vue'
import { api, ApiRequestError, call } from '../lib/api'
import { useConsentStore } from '../stores/consent'
import { useSessionStore } from '../stores/session'

/**
 * Saves consent, the online profile and the identity choice in one call (CON-02, PRO-01, PRO-05).
 * `save` resolves true when the account has a respondent afterwards: just saved, or saved
 * earlier (409, e.g. from another tab). Otherwise `error` says why, in words for students.
 */
export function useCreateRespondent() {
  const session = useSessionStore()
  const consent = useConsentStore()
  const saving = ref(false)
  const error = ref<string | null>(null)

  async function save(body: OnlineRespondentInput) {
    saving.value = true
    error.value = null
    try {
      session.setRespondent(await call(api.respondents.$post({ json: body })))
      consent.clear()
      return true
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'conflict') {
        consent.clear()
        await session.loadMe()
        if (session.me?.respondent) return true
        // The follow-up /me failed. A 401 there signs the user out without leaving the page.
        error.value = session.session
          ? 'Something went wrong. Please try again.'
          : 'You were signed out. Please sign in again.'
        return false
      }
      error.value =
        err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.'
      return false
    } finally {
      saving.value = false
    }
  }

  return { save, saving, error }
}
