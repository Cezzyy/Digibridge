import {
  createRouter,
  createWebHistory,
  isNavigationFailure,
  NavigationFailureType,
  START_LOCATION,
  type RouteLocationNormalized,
} from 'vue-router'
import { AUTH_CALLBACK_PARAMS } from './lib/supabase'
import HomePage from './pages/HomePage.vue'
import LandingPage from './pages/LandingPage.vue'
import NotFoundPage from './pages/NotFoundPage.vue'
import SignInPage from './pages/SignInPage.vue'
import { useSessionStore } from './stores/session'

// Who may open a page. No `requires` means anyone; `guest` means only signed-out users.
// These guards only decide what to show; the API checks the role again on every call (AUTH-04).
// The `step` and `kioskLock` guards from the TRD come with the consent and kiosk pages.
export type Requirement = 'guest' | 'signedIn' | 'staff' | 'admin'

declare module 'vue-router' {
  interface RouteMeta {
    requires?: Requirement
    /** The page draws its own top bar instead of AppHeader. */
    hideHeader?: boolean
  }
}

export const router = createRouter({
  history: createWebHistory(),
  // New pages open at the top; in-page links (#how) scroll to their section, smoothly unless
  // the user asks for less motion (style.css).
  scrollBehavior(to, _from, saved) {
    if (saved) return saved
    if (to.hash) return { el: to.hash }
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
    { path: '/home', name: 'home', component: HomePage, meta: { requires: 'signedIn' } },
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
function withoutCallbackParams(to: RouteLocationNormalized) {
  const keys: readonly string[] = AUTH_CALLBACK_PARAMS
  const inQuery = Object.keys(to.query).some((key) => keys.includes(key))
  const inHash = [...new URLSearchParams(to.hash.slice(1)).keys()].some((key) => keys.includes(key))
  if (!inQuery && !inHash) return null
  const query = Object.fromEntries(Object.entries(to.query).filter(([key]) => !keys.includes(key)))
  return { path: to.path, query, hash: inHash ? '' : to.hash, replace: true }
}

router.beforeEach(async (to, from) => {
  const clean = withoutCallbackParams(to)
  if (clean) return clean

  const requires = to.meta.requires
  if (!requires) return true

  const session = useSessionStore()
  await session.init()
  // App.vue shows the error screen over the first page, so stay there: "Try again" reloads it.
  if (session.failure && from === START_LOCATION) return true
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
})

// Going to any page after the first one (a button, the logo, the back button) closes the error
// screen. This runs in afterEach because a link to the page already open (the logo on `/`, where
// Google sends users back) skips beforeEach but still reaches afterEach, as a duplicate.
router.afterEach((_to, from, failure) => {
  if (from === START_LOCATION) return
  if (failure && !isNavigationFailure(failure, NavigationFailureType.duplicated)) return
  useSessionStore().clearFailure()
})
