<script setup lang="ts">
import { ATTEMPT_DURATION_MINUTES, ITEMS_PER_ATTEMPT } from '@digibridge/shared'
import { useSessionStore } from '../stores/session'

// Placeholder: the real copy (what DigiBridge is, how long it takes, privacy line) comes later.
// Signed-in users never see it; the `guest` guard sends them to /home.
const session = useSessionStore()
</script>

<template>
  <main class="mx-auto max-w-xl px-4 py-12 sm:py-20">
    <h1 class="text-3xl font-bold text-evergreen sm:text-4xl">DigiBridge</h1>
    <p class="mt-3 text-lg text-quiet">
      Check your digital skills and get lessons that match your level.
    </p>
    <p class="mt-2 text-quiet">
      {{ ITEMS_PER_ATTEMPT }} questions, about {{ ATTEMPT_DURATION_MINUTES }} minutes.
    </p>

    <!-- Google sends users back here, so a failed /me after sign-in shows up on this page. -->
    <p
      v-if="session.error"
      role="alert"
      class="mt-8 rounded-control bg-error-soft px-4 py-3 text-error"
    >
      {{ session.error }}
    </p>

    <RouterLink
      :to="{ name: 'sign-in' }"
      class="mt-8 inline-flex min-h-11 items-center rounded-control bg-evergreen px-6 font-semibold text-white hover:bg-evergreen-hover"
    >
      Get started
    </RouterLink>
  </main>
</template>
