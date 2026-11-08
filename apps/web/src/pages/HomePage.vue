<script setup lang="ts">
import { ROLE_LABELS } from '@digibridge/shared'
import { PRIMARY_BUTTON } from '../lib/buttons'
import { useSessionStore } from '../stores/session'

// Where signed-in users land. Respondents without a profile never see it: the `step` guard sends
// them to the privacy notice. Once the profile is saved they land here until the instructions
// page is built. Staff land here too (later /admin) and can try the respondent flow.
const session = useSessionStore()
</script>

<template>
  <main v-if="session.me && session.role" class="mx-auto max-w-xl px-4 py-12 sm:py-20">
    <template v-if="session.me.respondent">
      <h1 class="text-3xl font-bold text-evergreen sm:text-4xl">
        You’re all set, {{ session.me.respondent.fullName }}
      </h1>
      <p class="mt-3 text-lg text-quiet">
        Your profile is saved. The assessment isn’t open yet. Check back soon to take it and see
        your lessons here.
      </p>
    </template>
    <template v-else>
      <h1 class="text-3xl font-bold text-evergreen sm:text-4xl">
        Hi, {{ session.me.profile.fullName ?? session.me.profile.email }}
      </h1>
      <p class="mt-3 text-lg text-quiet">
        You’re signed in as {{ ROLE_LABELS[session.role].toLowerCase() }}. You can go through the
        student steps to see what they see.
      </p>
      <RouterLink :to="{ name: 'consent' }" :class="[PRIMARY_BUTTON, 'mt-6']">
        Try the student steps
      </RouterLink>
    </template>

    <section class="mt-8 rounded-card border border-line bg-surface p-6">
      <p class="font-semibold">Your account</p>
      <p class="mt-1 text-quiet">
        {{ session.me.profile.email }} · {{ ROLE_LABELS[session.role] }}
      </p>
    </section>
  </main>
</template>
