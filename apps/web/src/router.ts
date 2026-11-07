import { createRouter, createWebHistory } from 'vue-router'
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
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    // Google sends users back to `/`, and the `guest` guard there moves them on to /home.
    { path: '/', name: 'landing', component: LandingPage, meta: { requires: 'guest' } },
    { path: '/sign-in', name: 'sign-in', component: SignInPage, meta: { requires: 'guest' } },
    { path: '/home', name: 'home', component: HomePage, meta: { requires: 'signedIn' } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundPage },
  ],
})

router.beforeEach(async (to) => {
  const requires = to.meta.requires
  if (!requires) return true

  const session = useSessionStore()
  await session.init()
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
