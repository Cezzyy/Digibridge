<script setup lang="ts">
import GoogleSignInButton from '../components/GoogleSignInButton.vue'
import { useSessionStore } from '../stores/session'

// Sign in and sign up are the same step: Google sign-in, and the first one makes the account
// (AUTH-01, AUTH-02). Signed-in users never get here; the `guest` guard sends them home.
const session = useSessionStore()
</script>

<template>
  <main class="mx-auto max-w-md px-4 py-12 sm:py-20">
    <section class="rounded-card border border-line bg-surface p-6 sm:p-8">
      <h1 class="text-2xl font-bold text-evergreen sm:text-3xl">Sign in or sign up</h1>
      <p class="mt-3 text-quiet">
        Use your Google account. If this is your first time, we'll make your DigiBridge account for
        you.
      </p>

      <p
        v-if="session.error"
        role="alert"
        class="mt-6 rounded-control bg-error-soft px-4 py-3 text-error"
      >
        {{ session.error }}
      </p>

      <GoogleSignInButton class="mt-6 w-full" />
    </section>
  </main>
</template>
