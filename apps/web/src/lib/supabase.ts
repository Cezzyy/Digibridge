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

/** True when this page load is the return from Google. Read before the client below removes the code. */
export const returningFromGoogle = hasCallbackParams(window.location)

// Used only to sign in and out (Google). Everything else goes through the API.
// PKCE: Google sends the user back with ?code=..., which this client swaps for a session
// on page load and then removes from the address bar.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { flowType: 'pkce' } },
)
