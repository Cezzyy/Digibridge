import { STAFF_ROLES, type Role } from '@digibridge/shared'
import type { Session } from '@supabase/supabase-js'
import type { InferResponseType } from 'hono/client'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { api, ApiRequestError, call, messageOf, SOMETHING_WENT_WRONG } from '../lib/api'
import { markSignInStarted, returningFromGoogle, supabase } from '../lib/supabase'

export type Me = InferResponseType<typeof api.me.$get, 200>
export type RespondentSummary = NonNullable<Me['respondent']>

/**
 * Why the app can't go on, shown by App.vue as an ErrorScreen.
 * `sign-in`: the return from Google didn't end signed in (cancelled, expired code, token refused).
 * `unavailable`: signed in with Google, but /me failed (API down, no internet).
 * `page`: a page couldn't open, e.g. its code didn't download (flaky connection, or a new
 * deploy replaced the file). Set by the router.
 */
export type SessionFailure =
  { kind: 'sign-in' } | { kind: 'unavailable'; message: string } | { kind: 'page' }

// The Supabase session and the signed-in user from GET /api/v1/me.
export const useSessionStore = defineStore('session', () => {
  const session = shallowRef<Session | null>(null)
  const me = ref<Me | null>(null)
  const loading = ref(true)
  /** Google sign-in couldn't start; SignInPage shows it. */
  const error = ref<string | null>(null)
  const failure = ref<SessionFailure | null>(null)

  const isSignedIn = computed(() => me.value !== null)
  const role = computed<Role | null>(() => me.value?.profile.role ?? null)
  const isStaff = computed(() => STAFF_ROLES.some((r) => r === role.value))
  const isAdmin = computed(() => role.value === 'admin')

  async function loadMe() {
    // A load that ends signed out or signed in replaces any earlier failure (e.g. after a sign-in
    // or sign-out in another tab); only a failed /me sets a new one.
    if (!session.value) {
      me.value = null
      failure.value = null
      return
    }
    try {
      me.value = await call(api.me.$get())
      failure.value = null
    } catch (err) {
      me.value = null
      if (err instanceof ApiRequestError && err.code === 'unauthorized') {
        // The API turned the token down (expired or revoked): start over, signed out.
        await supabase.auth.signOut({ scope: 'local' })
        session.value = null
        return
      }
      failure.value = { kind: 'unavailable', message: messageOf(err) }
    }
  }

  let ready: Promise<void> | undefined

  /** Loads the session once; later calls wait for the same load. Route guards await this. */
  function init() {
    ready ??= (async () => {
      try {
        const { data } = await supabase.auth.getSession()
        session.value = data.session
        await loadMe()
      } catch {
        // Supabase itself threw (lock timeout, storage blocked). Never let this load reject: the
        // first page would then never resolve and App.vue would show the splash for good.
        me.value = null
        failure.value = { kind: 'unavailable', message: SOMETHING_WENT_WRONG }
      }
      // Back from Google but not signed in, and not because the API is down.
      if (returningFromGoogle && !me.value && !failure.value) failure.value = { kind: 'sign-in' }
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
    markSignInStarted(true)
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (signInError) {
      markSignInStarted(false)
      error.value = "We couldn't open Google sign-in. Please try again."
    }
  }

  /** Signs out on this device only, so a facilitator stays signed in on their other devices. */
  async function signOut() {
    await supabase.auth.signOut({ scope: 'local' })
    session.value = null
    me.value = null
    error.value = null
    failure.value = null
  }

  /** After saving the profile: the user is now a respondent, without another /me call. */
  function setRespondent(respondent: RespondentSummary) {
    if (me.value) me.value = { ...me.value, respondent }
  }

  /** After starting the assessment: the attempt /me would now return, without another call. */
  function setAttempt(attempt: NonNullable<Me['attempt']>) {
    if (me.value) me.value = { ...me.value, attempt }
  }

  /** Shows the error screen when a page couldn't open; the router calls it. */
  function failPage() {
    failure.value = { kind: 'page' }
  }

  /** Hides the error screen; the router calls it when the user goes to another page. */
  function clearFailure() {
    failure.value = null
  }

  return {
    session,
    me,
    loading,
    error,
    failure,
    isSignedIn,
    role,
    isStaff,
    isAdmin,
    init,
    loadMe,
    setRespondent,
    setAttempt,
    signIn,
    signOut,
    failPage,
    clearFailure,
  }
})
