import { createClient } from '@supabase/supabase-js'

// Used only to sign in and out (Google). Everything else goes through the API.
// PKCE: Google sends the user back with ?code=..., which this client swaps for a session
// on page load and then removes from the address bar.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { flowType: 'pkce' } },
)
