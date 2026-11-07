<script setup lang="ts">
import { ROLE_LABELS } from '@digibridge/shared'
import GoogleSignInButton from '../components/GoogleSignInButton.vue'
import { useSessionStore } from '../stores/session'

const session = useSessionStore()
</script>

<template>
  <main class="mx-auto max-w-xl px-4 py-12 sm:py-20">
    <h1 class="text-3xl font-bold text-evergreen sm:text-4xl">DigiBridge</h1>
    <p class="mt-3 text-lg text-quiet">
      Check your digital skills and get lessons that match your level.
    </p>

    <section class="mt-8 rounded-card border border-line bg-surface p-6">
      <p
        v-if="session.error"
        role="alert"
        class="mb-4 rounded-control bg-error-soft px-4 py-3 text-error"
      >
        {{ session.error }}
      </p>

      <p v-if="session.loading" class="text-quiet">Loading…</p>

      <template v-else-if="session.isSignedIn && session.me && session.role">
        <p class="text-lg">
          Signed in as
          <strong>{{ session.me.profile.fullName ?? session.me.profile.email }}</strong>
        </p>
        <p class="mt-1 text-quiet">
          {{ session.me.profile.email }} · {{ ROLE_LABELS[session.role] }}
        </p>
      </template>

      <template v-else>
        <p class="mb-4">Sign in with your Google account to start.</p>
        <GoogleSignInButton />
      </template>
    </section>
  </main>
</template>
