import {
  createRouter,
  createWebHistory,
  isNavigationFailure,
  NavigationFailureType,
  START_LOCATION,
  type RouteLocationNormalized,
} from 'vue-router'
import { findCallbackParams, isCallbackParam, returningFromGoogle } from './lib/supabase'
import AssessmentPage from './pages/assessment/AssessmentPage.vue'
import HomePage from './pages/HomePage.vue'
import LandingPage from './pages/LandingPage.vue'
import NotFoundPage from './pages/NotFoundPage.vue'
import SignInPage from './pages/SignInPage.vue'
import ConsentPage from './pages/start/ConsentPage.vue'
import ProfilePage from './pages/start/ProfilePage.vue'
import { useConsentStore } from './stores/consent'
import { useSessionStore } from './stores/session'

// Who may open a page. No `requires` means anyone; `guest` means only signed-out users.
// These guards only decide what to show; the API checks the role again on every call (AUTH-04).
// The `kioskLock` guard from the TRD comes with the kiosk pages.
export type Requirement = 'guest' | 'signedIn' | 'staff' | 'admin'

/** A page of the respondent flow, which the `step` guard keeps in order. */
export type Step = 'home' | 'consent' | 'profile' | 'assessment'

declare module 'vue-router' {
  interface RouteMeta {
    requires?: Requirement
    /** Checked after `requires`: sends users to the step they're on (see `checkStep`). */
    step?: Step
    /** The page draws its own top bar instead of AppHeader. */
    hideHeader?: boolean
  }
}

export const router = createRouter({
  history: createWebHistory(),
  // New pages open at the top; in-page links (#how) scroll to their section, smoothly unless
  // the user asks for less motion, and below the sticky top bar (both set in style.css).
  // `scrollIntoView` instead of `{ el: to.hash }`: Vue Router turns `el` into `window.scrollTo()`,
  // which ignores `scroll-padding-top`, so the section's heading would end up under the top bar.
  scrollBehavior(to, _from, saved) {
    if (saved) return saved
    if (to.hash) {
      document.getElementById(decodeURIComponent(to.hash.slice(1)))?.scrollIntoView()
      return false
    }
    return { top: 0, behavior: 'instant' }
  },
  routes: [
    // Google sends users back to `/`, and the `guest` guard there moves them on to /home.
    {
      path: '/',
      name: 'landing',
      component: LandingPage,
      meta: { requires: 'guest', hideHeader: true },
    },
    {
      path: '/sign-in',
      name: 'sign-in',
      component: SignInPage,
      meta: { requires: 'guest', hideHeader: true },
    },
    {
      path: '/home',
      name: 'home',
      component: HomePage,
      meta: { requires: 'signedIn', step: 'home' },
    },
    {
      path: '/start/consent',
      name: 'consent',
      component: ConsentPage,
      meta: { requires: 'signedIn', step: 'consent' },
    },
    {
      path: '/start/profile',
      name: 'profile',
      component: ProfilePage,
      meta: { requires: 'signedIn', step: 'profile' },
    },
    // Draws its own top bar, with the timer in it.
    {
      path: '/assessment',
      name: 'assessment',
      component: AssessmentPage,
      meta: { requires: 'signedIn', step: 'assessment', hideHeader: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundPage,
      meta: { hideHeader: true },
    },
  ],
})

// Google's leftovers in the address bar (?code=, ?error=), which Supabase has read on page load.
// On success Supabase removes them itself; on failure they'd stay, so the guard drops them.
// Only on the page load that returns from Google, so other pages can still use these names.
function withoutCallbackParams(to: RouteLocationNormalized, from: RouteLocationNormalized) {
  if (!returningFromGoogle || from !== START_LOCATION) return null
  const { inQuery, inHash } = findCallbackParams(Object.keys(to.query), to.hash)
  if (!inQuery && !inHash) return null
  const query = Object.fromEntries(
    Object.entries(to.query).filter(([key]) => !isCallbackParam(key)),
  )
  return { path: to.path, query, hash: inHash ? '' : to.hash, replace: true }
}

// Whether the signed-in user may open a page, or where to go instead.
function checkRequirement(requires: Requirement) {
  const session = useSessionStore()
  switch (requires) {
    case 'guest':
      return !session.isSignedIn || { name: 'home' }
    case 'signedIn':
      return session.isSignedIn || { name: 'sign-in' }
    case 'staff':
      return session.isStaff || { name: session.isSignedIn ? 'home' : 'sign-in' }
    case 'admin':
      return session.isAdmin || { name: session.isSignedIn ? 'home' : 'sign-in' }
  }
}

// The respondent flow in order: consent, profile, home, then the assessment. A new respondent's
// first sign-in lands on /home and goes on to the notice; once the profile is saved, both start
// pages send them home, and Start on home opens the assessment. Only an attempt in progress can
// be opened; once it's submitted or expired, /assessment sends them home. Staff stay on /home
// and can open the notice from there to try the flow; they never get an attempt.
function checkStep(step: Step) {
  const session = useSessionStore()
  const me = session.me
  if (!me) return { name: 'sign-in' }
  const hasProfile = me.respondent !== null
  switch (step) {
    case 'home':
      return hasProfile || session.isStaff || { name: 'consent' }
    case 'consent':
      return !hasProfile || { name: 'home' }
    case 'profile':
      if (hasProfile) return { name: 'home' }
      // The notice comes first, and its answer lives in memory only (stores/consent.ts).
      return useConsentStore().versionFor(me.profile.id) !== null || { name: 'consent' }
    case 'assessment':
      return me.attempt?.status === 'in_progress' || { name: 'home' }
  }
}

router.beforeEach(async (to, from) => {
  const clean = withoutCallbackParams(to, from)
  if (clean) return clean

  const requires = to.meta.requires
  if (!requires) return true

  const session = useSessionStore()
  await session.init()
  // App.vue shows the error screen over the first page, so stay there: "Try again" reloads it.
  if (session.failure && from === START_LOCATION) return true
  const allowed = checkRequirement(requires)
  if (allowed !== true || !to.meta.step) return allowed
  return checkStep(to.meta.step)
})

// Going to any page after the first one (a button, the logo, the back button) closes the error
// screen. This runs in afterEach because a link to the page already open (the logo on `/`, where
// Google sends users back) skips beforeEach but still reaches afterEach, as a duplicate.
router.afterEach((_to, from, failure) => {
  if (from === START_LOCATION) return
  if (failure && !isNavigationFailure(failure, NavigationFailureType.duplicated)) return
  useSessionStore().clearFailure()
})
