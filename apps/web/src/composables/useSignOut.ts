import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session'

// Sign out asks first, so a stray tap on a Sign out button doesn't end the session (AUTH-03).
// Every Sign out button calls `askSignOut`; the one `SignOutDialog` in App.vue asks and signs out.
// The state is shared, so a button inside the side menu opens the same dialog, on top of the menu.

const asking = ref(false)
const signingOut = ref(false)

/** Opens the "Sign out?" dialog. */
export function askSignOut() {
  asking.value = true
}

/** For `SignOutDialog` only: the dialog's state, and signing out once confirmed. */
export function useSignOut() {
  const session = useSessionStore()
  const router = useRouter()

  function cancel() {
    if (!signingOut.value) asking.value = false
  }

  async function confirm() {
    signingOut.value = true
    try {
      await session.signOut()
      await router.push({ name: 'landing' })
    } finally {
      signingOut.value = false
      asking.value = false
    }
  }

  return { asking, signingOut, cancel, confirm }
}
