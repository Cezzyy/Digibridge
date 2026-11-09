<script setup lang="ts">
import { useSessionStore } from '../stores/session'
import AccountControls from './AccountControls.vue'
import BrandMark from './BrandMark.vue'

// Top bar on every page, so users can sign in or out from anywhere (AUTH-03). It stays at the
// top while the page scrolls, and spans the whole width like the start pages under it. The
// lessons link shows from `sm`: on phones there's no room beside Sign out.
const session = useSessionStore()
</script>

<template>
  <header class="sticky top-0 z-30 h-header border-b border-line bg-surface">
    <div class="flex h-full w-full items-center justify-between gap-4 px-4 sm:px-8 lg:px-10">
      <RouterLink
        :to="{ name: session.isSignedIn ? 'home' : 'landing' }"
        class="flex min-h-11 items-center gap-2.5 font-display text-xl font-bold text-evergreen"
      >
        <BrandMark class="size-8" />
        DigiBridge
      </RouterLink>

      <div class="flex min-w-0 items-center gap-2 sm:gap-4">
        <RouterLink
          :to="{ name: 'lessons' }"
          class="hidden min-h-11 shrink-0 items-center rounded-control px-3 font-semibold text-quiet hover:text-ink sm:flex"
        >
          Lessons
        </RouterLink>

        <AccountControls v-if="session.isSignedIn" />

        <RouterLink
          v-else-if="!session.loading"
          :to="{ name: 'sign-in' }"
          class="flex min-h-11 shrink-0 items-center rounded-control border border-line-strong px-4 font-semibold text-evergreen hover:bg-evergreen-soft"
        >
          Sign in
        </RouterLink>
      </div>
    </div>
  </header>
</template>
