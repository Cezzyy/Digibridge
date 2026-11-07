<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import AppSplash from './components/AppSplash.vue'
import ErrorScreen, { type ErrorAction } from './components/ErrorScreen.vue'
import IntroSplash from './components/IntroSplash.vue'
import { useSessionStore } from './stores/session'

// Load the session for every page, including public ones that have no guard.
const session = useSessionStore()
void session.init()

// Until the first page resolves (the guards wait for the session and /me), show the splash
// instead of a blank screen. This also keeps the landing page from flashing AppHeader first.
const route = useRoute()
const router = useRouter()
const starting = computed(() => route.matched.length === 0)
const showHeader = computed(() => !route.meta.hideHeader)

// When signing in fails or the API can't be reached, the error screen takes the whole page.
// Going to another page closes it (router.ts).
const failureScreen = computed(() => {
  const failure = session.failure
  if (!failure) return null

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
      { label: 'Try again', onClick: () => window.location.reload() },
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
  <AppSplash v-if="starting" />
  <ErrorScreen v-else-if="failureScreen" v-bind="failureScreen" />
  <template v-else>
    <AppHeader v-if="showHeader" />
    <RouterView />
  </template>
  <IntroSplash />
</template>
