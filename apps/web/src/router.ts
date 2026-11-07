import { createRouter, createWebHistory } from 'vue-router'
import LandingPage from './pages/LandingPage.vue'
import NotFoundPage from './pages/NotFoundPage.vue'
import { useSessionStore } from './stores/session'

// Who may open a page. No `requires` means anyone. These guards only decide what to show;
// the API checks the role again on every call (AUTH-04).
// The `step` and `kioskLock` guards from the TRD come with the consent and kiosk pages.
export type Requirement = 'signedIn' | 'staff' | 'admin'

declare module 'vue-router' {
  interface RouteMeta {
    requires?: Requirement
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'landing', component: LandingPage },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundPage },
  ],
})

router.beforeEach(async (to) => {
  const requires = to.meta.requires
  if (!requires) return true

  const session = useSessionStore()
  await session.init()
  const allowed =
    requires === 'signedIn'
      ? session.isSignedIn
      : requires === 'staff'
        ? session.isStaff
        : session.isAdmin
  return allowed || { name: 'landing' }
})
