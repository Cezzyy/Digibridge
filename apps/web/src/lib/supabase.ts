import { createClient } from '@supabase/supabase-js'

// What Google sign-in leaves in the address bar on the way back: ?code=... when it worked,
// ?error=... when the user cancelled or it failed. Supabase reads the query and the hash.
export const AUTH_CALLBACK_PARAMS = [
  'code',
  'sb_flow_id',
  'error',
  'error_code',
  'error_description',
] as const

function hasCallbackParams(location: Location) {
  const query = new URLSearchParams(location.search)
  const hash = new URLSearchParams(location.hash.slice(1))
  return AUTH_CALLBACK_PARAMS.some((key) => query.has(key) || hash.has(key))
}

// Set just before leaving for Google, so a page that happens to have ?code= or ?error= in its
// address isn't taken for the return from Google. sessionStorage lasts for this tab only.
const SIGN_IN_STARTED_KEY = 'digibridge:sign-in-started'

export function markSignInStarted(started: boolean) {
  try {
    if (started) sessionStorage.setItem(SIGN_IN_STARTED_KEY, '1')
    else sessionStorage.removeItem(SIGN_IN_STARTED_KEY)
  } catch {
    // Storage blocked: the return from Google then looks like a normal page load.
  }
}

function takeSignInStarted() {
  try {
    const started = sessionStorage.getItem(SIGN_IN_STARTED_KEY) !== null
    sessionStorage.removeItem(SIGN_IN_STARTED_KEY)
    return started
  } catch {
    return false
  }
}

/**
 * True when this page load is the return from Google: this tab left for Google and came back with
 * its params. Read before the client below removes the code.
 */
export const returningFromGoogle = takeSignInStarted() && hasCallbackParams(window.location)

// Used only to sign in and out (Google). Everything else goes through the API.
// PKCE: Google sends the user back with ?code=..., which this client swaps for a session
// on page load and then removes from the address bar.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { flowType: 'pkce' } },
)
