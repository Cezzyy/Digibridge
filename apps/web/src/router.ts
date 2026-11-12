import {
  createRouter,
  createWebHistory,
  isNavigationFailure,
  NavigationFailureType,
  START_LOCATION,
  type RouteLocationNormalized,
} from 'vue-router'
import { findCallbackParams, isCallbackParam, returningFromGoogle } from './lib/supabase'
import { followSystemTheme } from './lib/theme'
import AssessmentPage from './pages/assessment/AssessmentPage.vue'
import HomePage from './pages/HomePage.vue'
import LandingPage from './pages/LandingPage.vue'
import LessonsPage from './pages/lessons/LessonsPage.vue'
import NotFoundPage from './pages/NotFoundPage.vue'
import SignInPage from './pages/SignInPage.vue'
import ConsentPage from './pages/start/ConsentPage.vue'
import ProfilePage from './pages/start/ProfilePage.vue'
import { useConsentStore } from './stores/consent'
import { useSessionStore } from './stores/session'

// Who may open a page. No `requires` means anyone; `guest` means only signed-out users.
// These guards only decide what to show; the API checks the role again on every call (AUTH-04).
// The `kioskLock` guard from the TRD comes with the kiosk pages. The TRD's `public` (the lessons)
// is the same as no `requires`.
export type Requirement = 'guest' | 'signedIn' | 'staff' | 'admin'

/** A page of the respondent flow, which the `step` guard keeps in order. */
export type Step = 'home' | 'consent' | 'profile' | 'assessment' | 'results'

declare module 'vue-router' {
  interface RouteMeta {
    requires?: Requirement
    /** Checked after `requires`: sends users to the step they're on (see `checkStep`). */
    step?: Step
    /** The page draws its own top bar instead of AppHeader. */
    hideHeader?: boolean
    /** Dark when the system is dark (lib/theme.ts). Children inherit it. */
    followsSystemTheme?: boolean
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
    // Google sends users back to `/`, and the `guest` guard there moves them on: staff to /admin,
    // everyone else to /home.
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
    // Lazy, so Chart.js (the radar chart) loads only here, not with the first page.
    {
      path: '/results',
      name: 'results',
      component: () => import('./pages/results/ResultsPage.vue'),
      meta: { requires: 'signedIn', step: 'results' },
    },
    // The lessons library and each lesson, open to everyone (LES-03), so no `requires`.
    { path: '/lessons', name: 'lessons', component: LessonsPage },
    // Lazy, so markdown-it and DOMPurify load only here.
    {
      path: '/lessons/:slug',
      name: 'lesson',
      component: () => import('./pages/lessons/LessonPage.vue'),
    },
    // The admin area, lazy so students never download it. Staff (facilitators and admins) see the
    // overview; making school links is for admins only (LNK-01). Children inherit `requires`
    // unless they set their own.
    {
      path: '/admin',
      component: () => import('./pages/admin/AdminLayout.vue'),
      meta: { requires: 'staff', followsSystemTheme: true },
      children: [
        {
          path: '',
          name: 'admin',
          component: () => import('./pages/admin/OverviewPage.vue'),
        },
        // Staff, read only for facilitators (DSH-07); the answer sheet is for admins only.
        {
          path: 'respondents',
          name: 'admin-respondents',
          component: () => import('./pages/admin/RespondentsPage.vue'),
        },
        {
          path: 'analysis',
          name: 'admin-analysis',
          component: () => import('./pages/admin/AnalysisPage.vue'),
        },
        {
          path: 'items',
          name: 'admin-items',
          component: () => import('./pages/admin/ItemsPage.vue'),
          meta: { requires: 'admin' },
        },
        {
          path: 'links',
          name: 'admin-links',
          component: () => import('./pages/admin/LinksPage.vue'),
          meta: { requires: 'admin' },
        },
      ],
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
  const signedInHome = session.isSignedIn ? session.startPage : { name: 'sign-in' }
  switch (requires) {
    case 'guest':
      return !session.isSignedIn || session.startPage
    case 'signedIn':
      return session.isSignedIn || { name: 'sign-in' }
    case 'staff':
      return session.isStaff || signedInHome
    case 'admin':
      return session.isAdmin || signedInHome
  }
}

// The respondent flow in order: consent, profile, home, the assessment, then results. A new
// respondent's first sign-in lands on /home and goes on to the notice; once the profile is saved,
// both start pages send them home, and Start on home opens the assessment. Only an attempt in
// progress can be opened; once it's submitted or expired, home and /assessment send them to
// their results, and so does every later sign-in (PRO-07, RES-03). Staff land on /admin, and can
// open /home from there to try the flow; they never get an attempt, so never results.
function checkStep(step: Step) {
  const session = useSessionStore()
  const me = session.me
  if (!me) return { name: 'sign-in' }
  const hasProfile = me.respondent !== null
  const finished = session.attemptFinished
  switch (step) {
    case 'home':
      if (finished) return { name: 'results' }
      return hasProfile || session.isStaff || { name: 'consent' }
    case 'consent':
      return !hasProfile || { name: 'home' }
    case 'profile':
      if (hasProfile) return { name: 'home' }
      // The notice comes first, and its answer lives in memory only (stores/consent.ts).
      return useConsentStore().versionFor(me.profile.id) !== null || { name: 'consent' }
    case 'assessment':
      return me.attempt?.status === 'in_progress' || { name: 'home' }
    case 'results':
      return finished || { name: 'home' }
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

// A navigation that throws, most often a lazy page (/results) whose code didn't download: the
// page never opens, and on the first one App.vue would show the splash for good. Show the error
// screen instead; its Try again reloads, which also picks up a new deploy's file names.
router.onError(() => useSessionStore().failPage())

// The page that opened sets the theme. A navigation that failed leaves the current one.
router.afterEach((to, _from, failure) => {
  if (!failure) followSystemTheme(to.matched.some((route) => route.meta.followsSystemTheme))
})

// Going to any page after the first one (a button, the logo, the back button) closes the error
// screen. This runs in afterEach because a link to the page already open (the logo on `/`, where
// Google sends users back) skips beforeEach but still reaches afterEach, as a duplicate.
router.afterEach((_to, from, failure) => {
  if (from === START_LOCATION) return
  if (failure && !isNavigationFailure(failure, NavigationFailureType.duplicated)) return
  useSessionStore().clearFailure()
})
