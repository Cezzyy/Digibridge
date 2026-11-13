import type { SchoolRespondentInput } from '@digibridge/shared'
import { ref } from 'vue'
import { call, messageOf, schoolApi } from '../lib/api'
import { useConsentStore } from '../stores/consent'
import { useSchoolLinkStore } from '../stores/schoolLink'

/**
 * Saves consent, the school profile and the identity choice through a school link in one call
 * (LNK-03, CON-02, PRO-05), then keeps the respondent token in this browser (LNK-04). `save`
 * resolves true once the student has joined. Otherwise `error` says why in the API's words for
 * students: a student number already used, or a link that closed or filled up meanwhile.
 */
export function useJoinLink() {
  const school = useSchoolLinkStore()
  const consent = useConsentStore()
  const saving = ref(false)
  const error = ref<string | null>(null)

  async function save(code: string, body: SchoolRespondentInput) {
    saving.value = true
    error.value = null
    try {
      const joined = await call(
        // No token yet, and never the Google one: joining is open to anyone with the link.
        schoolApi(null).links[':code'].respondents.$post({ param: { code }, json: body }),
      )
      school.join(code, joined.token, joined.respondent)
      consent.clear()
      return true
    } catch (err) {
      error.value = messageOf(err)
      return false
    } finally {
      saving.value = false
    }
  }

  return { save, saving, error }
}
