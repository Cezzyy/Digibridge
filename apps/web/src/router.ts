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
import { linkConsentKey, useSchoolLinkStore } from './stores/schoolLink'
import { useSessionStore } from './stores/session'

// Who may open a page. No `requires` means anyone; `guest` means only signed-out users.
// These guards only decide what to show; the API checks the role again on every call (AUTH-04).
// The TRD's `public` (the lessons) is the same as no `requires`. School-link pages (`school`)
// need no sign-in: the student's place is the respondent token their browser keeps.
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
    /** Below `lg`, AppHeader's menu has the admin pages (AdminMenu) instead of AppMenu. */
    adminMenu?: boolean
    /** An admin page that uses the whole width beside the side menu, like the lessons editor. */
    adminWide?: boolean
    /** A school-link page (/s/:code/…): the respondent flow without Google (LNK-02). */
    school?: boolean
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
    // Both privacy notices, open to everyone, signed in or not, so no `requires`. Lazy, since few
    // visitors open it. Google's OAuth consent screen links here.
    {
      path: '/privacy',
      name: 'privacy',
      component: () => import('./pages/PrivacyPage.vue'),
      meta: { hideHeader: true },
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
      meta: { requires: 'staff', followsSystemTheme: true, adminMenu: true },
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
        // The questions editor (CMS-01 to CMS-03), admin only: the list, then one question, new
        // or saved.
        {
          path: 'questions',
          name: 'admin-questions',
          component: () => import('./pages/admin/QuestionListPage.vue'),
          meta: { requires: 'admin' },
        },
        {
          path: 'questions/new',
          name: 'admin-question-new',
          component: () => import('./pages/admin/QuestionEditorPage.vue'),
          meta: { requires: 'admin', adminWide: true },
        },
        {
          path: 'questions/:id',
          name: 'admin-question',
          component: () => import('./pages/admin/QuestionEditorPage.vue'),
          meta: { requires: 'admin', adminWide: true },
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
        // The lessons editor (CMS-04), admin only: the list, then one lesson, new or saved.
        {
          path: 'lessons',
          name: 'admin-lessons',
          component: () => import('./pages/admin/LessonListPage.vue'),
          meta: { requires: 'admin' },
        },
        {
          path: 'lessons/new',
          name: 'admin-lesson-new',
          component: () => import('./pages/admin/LessonEditorPage.vue'),
          meta: { requires: 'admin', adminWide: true },
        },
        {
          path: 'lessons/:id',
          name: 'admin-lesson',
          component: () => import('./pages/admin/LessonEditorPage.vue'),
          meta: { requires: 'admin', adminWide: true },
        },
      ],
    },
    // School links (LNK-02 to LNK-06): the same pages as online, in school mode
    // (useRespondentFlow), at /s/<code>. Students open the link without signing in; the notice
    // comes first, then the profile with the school details. Done at the end clears the student
    // from the browser and shows the last page, which needs neither the link nor a token.
    {
      path: '/s/:code',
      name: 'school-consent',
      component: ConsentPage,
      meta: { school: true, step: 'consent' },
    },
    {
      path: '/s/:code/profile',
      name: 'school-profile',
      component: ProfilePage,
      meta: { school: true, step: 'profile' },
    },
    {
      path: '/s/:code/home',
      name: 'school-home',
      component: HomePage,
      meta: { school: true, step: 'home' },
    },
    {
      path: '/s/:code/assessment',
      name: 'school-assessment',
      component: AssessmentPage,
      meta: { school: true, step: 'assessment', hideHeader: true },
    },
    {
      path: '/s/:code/results',
      name: 'school-results',
      component: () => import('./pages/results/ResultsPage.vue'),
      meta: { school: true, step: 'results' },
    },
    {
      path: '/s/:code/done',
      name: 'school-done',
      component: () => import('./pages/school/DonePage.vue'),
      meta: { hideHeader: true },
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

// The same flow through a school link, from the link's state (GET /links/:code) instead of /me:
// the notice and profile until the student joins, then home, the assessment and results. A
// student who joined can always come back, even once the link closed (LNK-04). Staff signed in
// with Google never join: they go through the same pages as a preview, as they do online.
function checkSchoolStep(code: string, step: Step | undefined) {
  const school = useSchoolLinkStore()
  const at = (name: string) => ({ name, params: { code } })
  const joined = school.respondent !== null
  const status = school.attempt?.status
  const finished = status === 'submitted' || status === 'expired'
  switch (step) {
    case 'consent':
      return !joined || at('school-home')
    case 'profile':
      if (joined) return at('school-home')
      return useConsentStore().versionFor(linkConsentKey(code)) !== null || at('school-consent')
    case 'home':
      // Staff who open a link get a preview: home without joining, like online (LNK-01).
      if (!joined) return useSessionStore().isStaff || at('school-consent')
      return !finished || at('school-results')
    case 'assessment':
      return status === 'in_progress' || at('school-home')
    case 'results':
      return finished || at('school-home')
    default:
      return true
  }
}

async function enterSchoolLink(to: RouteLocationNormalized) {
  const school = useSchoolLinkStore()
  const code = String(to.params.code)
  // Codes are upper case; one typed in lower case opens the same link.
  if (code !== code.toUpperCase()) {
    return {
      name: to.name,
      params: { ...to.params, code: code.toUpperCase() },
      query: to.query,
      hash: to.hash,
      replace: true,
    }
  }
  // A browser that joined one link carries on there: a student takes the assessment once.
  const joined = school.joinedCode
  if (joined && joined !== code) {
    return { name: 'school-consent', params: { code: joined }, replace: true }
  }
  // The Google session too: staff who open the link get a preview that saves nothing.
  await Promise.all([useSessionStore().init(), school.open(code)])
  // App.vue shows the error screen over the page for a link that can't be opened (LNK-02).
  if (school.failure) return true
  return checkSchoolStep(code, to.meta.step)
}

router.beforeEach(async (to, from) => {
  const clean = withoutCallbackParams(to, from)
  if (clean) return clean

  if (to.meta.school) return enterSchoolLink(to)

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

// The page that opened sets the theme, and whether it's a school link's (school mode, which
// picks the student's calls). Only once it has opened: while a guard decides, the page on screen
// keeps its mode, and so do its calls. A navigation that failed leaves the current ones.
router.afterEach((to, _from, failure) => {
  if (failure) return
  followSystemTheme(to.matched.some((route) => route.meta.followsSystemTheme))
  useSchoolLinkStore().show(to.meta.school ? String(to.params.code) : null)
})

// Going to any page after the first one (a button, the logo, the back button) closes the error
// screen. This runs in afterEach because a link to the page already open (the logo on `/`, where
// Google sends users back) skips beforeEach but still reaches afterEach, as a duplicate.
router.afterEach((_to, from, failure) => {
  if (from === START_LOCATION) return
  if (failure && !isNavigationFailure(failure, NavigationFailureType.duplicated)) return
  useSessionStore().clearFailure()
})
