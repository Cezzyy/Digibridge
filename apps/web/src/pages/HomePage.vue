<script setup lang="ts">
import { ROLE_LABELS } from '@digibridge/shared'
import { useSessionStore } from '../stores/session'

// Placeholder: where signed-in users land. Later it sends respondents to /start/consent
// (or the step they're on) and staff to /admin.
const session = useSessionStore()
</script>

<template>
  <main v-if="session.me && session.role" class="mx-auto max-w-xl px-4 py-12 sm:py-20">
    <h1 class="text-3xl font-bold text-evergreen sm:text-4xl">
      Hi, {{ session.me.profile.fullName ?? session.me.profile.email }}
    </h1>
    <p class="mt-3 text-lg text-quiet">You're signed in. The assessment isn't open yet.</p>

    <section class="mt-8 rounded-card border border-line bg-surface p-6">
      <p class="font-semibold">Your account</p>
      <p class="mt-1 text-quiet">
        {{ session.me.profile.email }} · {{ ROLE_LABELS[session.role] }}
      </p>
    </section>

    <p class="mt-6 rounded-control bg-marigold-soft px-4 py-3">
      Check back soon. You'll take the assessment and see your lessons here.
    </p>
  </main>
</template>
