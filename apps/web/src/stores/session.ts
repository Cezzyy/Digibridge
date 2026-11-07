import { STAFF_ROLES, type Role } from '@digibridge/shared'
import type { Session } from '@supabase/supabase-js'
import type { InferResponseType } from 'hono/client'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { api, ApiRequestError, call } from '../lib/api'
import { supabase } from '../lib/supabase'

export type Me = InferResponseType<typeof api.me.$get, 200>

// The Supabase session and the signed-in user from GET /api/v1/me.
export const useSessionStore = defineStore('session', () => {
  const session = shallowRef<Session | null>(null)
  const me = ref<Me | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  const isSignedIn = computed(() => me.value !== null)
  const role = computed<Role | null>(() => me.value?.profile.role ?? null)
  const isStaff = computed(() => STAFF_ROLES.some((r) => r === role.value))
  const isAdmin = computed(() => role.value === 'admin')

  async function loadMe() {
    if (!session.value) {
      me.value = null
      return
    }
    try {
      me.value = await call(api.me.$get())
      error.value = null
    } catch (err) {
      me.value = null
      if (err instanceof ApiRequestError && err.code === 'unauthorized') {
        // The API turned the token down (expired or revoked): start over.
        await supabase.auth.signOut({ scope: 'local' })
        session.value = null
      }
      error.value =
        err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.'
    }
  }

  let ready: Promise<void> | undefined

  /** Loads the session once; later calls wait for the same load. Route guards await this. */
  function init() {
    ready ??= (async () => {
      const { data } = await supabase.auth.getSession()
      session.value = data.session
      await loadMe()
      loading.value = false

      supabase.auth.onAuthStateChange((_event, next) => {
        const userChanged = next?.user.id !== session.value?.user.id
        session.value = next
        // Supabase warns against calling it from inside this callback, so load /me after it.
        // A refreshed token for the same user needs no new /me.
        if (userChanged) setTimeout(() => void loadMe(), 0)
      })
    })()
    return ready
  }

  /** Leaves for Google's sign-in page; Supabase brings the user back to this site. */
  async function signIn() {
    error.value = null
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (signInError) error.value = "We couldn't open Google sign-in. Please try again."
  }

  /** Signs out on this device only, so a facilitator stays signed in on their other devices. */
  async function signOut() {
    await supabase.auth.signOut({ scope: 'local' })
    session.value = null
    me.value = null
    error.value = null
  }

  return { session, me, loading, error, isSignedIn, role, isStaff, isAdmin, init, signIn, signOut }
})
