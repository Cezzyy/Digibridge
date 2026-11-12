import { defineStore } from 'pinia'
import { ref } from 'vue'

// Who agreed to which privacy notice on the consent page, until the profile page saves both
// together (CON-02). Memory only: declining, a refresh or closing the tab leaves nothing behind.
// Keyed by who is agreeing (`useRespondentFlow().consentKey`: the Google account, or the school
// link), so another account signing in on this tab starts at the notice again.
export const useConsentStore = defineStore('consent', () => {
  const agreed = ref<{ key: string; version: string } | null>(null)

  function agree(key: string, version: string) {
    agreed.value = { key, version }
  }

  /** The notice version agreed to under this key, or null. */
  function versionFor(key: string) {
    return agreed.value?.key === key ? agreed.value.version : null
  }

  function clear() {
    agreed.value = null
  }

  return { agree, versionFor, clear }
})
