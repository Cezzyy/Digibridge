<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import AppSplash from './components/AppSplash.vue'
import ErrorScreen, { type ErrorAction } from './components/ErrorScreen.vue'
import IntroSplash from './components/IntroSplash.vue'
import SignOutDialog from './components/SignOutDialog.vue'
import { useSchoolLinkStore, type SchoolLinkFailure } from './stores/schoolLink'
import { useSessionStore } from './stores/session'

// Load the session for every page, including public ones that have no guard.
const session = useSessionStore()
const school = useSchoolLinkStore()
void session.init()

// Until the first page resolves (the guards wait for the session and /me), show the splash
// instead of a blank screen. This also keeps the landing page from flashing AppHeader first.
const route = useRoute()
const router = useRouter()
const starting = computed(() => route.matched.length === 0)
const showHeader = computed(() => !route.meta.hideHeader)
// The respondent pages (notice, profile, home, assessment, results) serve both online and school
// links, and read their mode, notice and link once at setup. Vue would reuse the instance when
// the route switches modes or links, so a new key remounts them instead.
const pageKey = computed(() => (route.meta.school ? `school:${String(route.params.code)}` : 'app'))

const retry: ErrorAction = { label: 'Try again', onClick: () => window.location.reload() }

// A school link that can't be opened (LNK-02): no such code, closed, expired or full for a new
// student, or the API unreachable. Only on the link's own pages.
const SCHOOL_LINK_TITLES = {
  'not-found': 'We couldn’t find this link',
  gone: 'This link is no longer open',
  unavailable: 'We couldn’t open this link',
} as const satisfies Record<SchoolLinkFailure['kind'], string>
const schoolLinkScreen = computed(() => {
  const failure = route.meta.school ? school.failure : null
  if (!failure) return null
  const lessons: ErrorAction = { label: 'Browse the lessons', to: { name: 'lessons' } }
  return {
    title: SCHOOL_LINK_TITLES[failure.kind],
    message: failure.message,
    // The link won't open for this student, but the lessons are open to everyone.
    actions: [failure.kind === 'unavailable' ? retry : lessons],
  }
})

// When signing in fails, the API can't be reached or a page won't open, the error screen takes
// the whole page. Going to another page closes it (router.ts).
const failureScreen = computed(() => {
  // School-link pages don't use the Google sign-in, so only a page that won't open counts there.
  const failure = route.meta.school && session.failure?.kind !== 'page' ? null : session.failure
  if (!failure) return schoolLinkScreen.value

  if (failure.kind === 'page') {
    return {
      title: "We couldn't open this page",
      message: 'Part of the page didn’t load. Check your internet connection, then try again.',
      actions: [retry],
    }
  }
  const home: ErrorAction = { label: 'Back to the home page', to: { name: 'landing' } }
  if (failure.kind === 'sign-in') {
    return {
      title: "We couldn't sign you in",
      message:
        "Google sign-in didn't finish. This happens if you cancel on Google's page or wait too long. Please try again.",
      actions: [{ label: 'Try again', to: { name: 'sign-in' } }, home],
    }
  }
  return {
    title: "We couldn't load your account",
    message: failure.message,
    actions: [
      retry,
      {
        label: 'Sign out',
        onClick: async () => {
          await session.signOut()
          await router.push({ name: 'landing' })
        },
      },
    ],
  }
})
</script>

<template>
  <!-- The error screen comes first: a first page that fails to open never ends `starting`. -->
  <ErrorScreen v-if="failureScreen" v-bind="failureScreen" />
  <AppSplash v-else-if="starting" />
  <template v-else>
    <AppHeader v-if="showHeader" />
    <RouterView :key="pageKey" />
  </template>
  <!-- Outside the v-if, so Sign out on the error screen's top bar asks too. -->
  <SignOutDialog />
  <IntroSplash />
</template>
