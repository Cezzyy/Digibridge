import { defineStore } from 'pinia'
import { ref } from 'vue'

// Who agreed to which privacy notice on the consent page, until the profile page saves both
// together (CON-02). Memory only: declining, a refresh or closing the tab leaves nothing behind.
// Keyed by account, so another account signing in on this tab starts at the notice again.
export const useConsentStore = defineStore('consent', () => {
  const agreed = ref<{ profileId: string; version: string } | null>(null)

  function agree(profileId: string, version: string) {
    agreed.value = { profileId, version }
  }

  /** The notice version this account agreed to, or null. */
  function versionFor(profileId: string) {
    return agreed.value?.profileId === profileId ? agreed.value.version : null
  }

  function clear() {
    agreed.value = null
  }

  return { agree, versionFor, clear }
})
