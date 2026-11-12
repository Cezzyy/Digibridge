<script setup lang="ts">
import { useRespondentFlow } from '../composables/useRespondentFlow'
import { askSignOut } from '../composables/useSignOut'
import { useSessionStore } from '../stores/session'

// The signed-in user's picture, name and Sign out button, for every top bar that a signed-in
// user can see (AUTH-03). Sign out asks first (`SignOutDialog`). Shows nothing when signed out.
// On a school-link page it's the student's name and "Not you?" instead, which clears them from
// this browser (after asking) for someone else on a shared phone or laptop.
const session = useSessionStore()
const flow = useRespondentFlow()
const BUTTON =
  'min-h-11 shrink-0 rounded-control border border-line-strong px-4 font-semibold text-evergreen hover:bg-evergreen-soft'
</script>

<template>
  <template v-if="flow.isSchool.value">
    <div v-if="flow.respondent.value" class="flex min-w-0 items-center gap-3">
      <span class="hidden truncate text-quiet sm:inline">{{ flow.respondent.value.fullName }}</span>
      <button type="button" :class="BUTTON" @click="askSignOut">Not you?</button>
    </div>
  </template>
  <div v-else-if="session.me" class="flex min-w-0 items-center gap-3">
    <img
      v-if="session.me.profile.avatarUrl"
      :src="session.me.profile.avatarUrl"
      alt=""
      class="size-8 shrink-0 rounded-full"
      referrerpolicy="no-referrer"
    />
    <span class="hidden truncate text-quiet sm:inline">
      {{ session.me.profile.fullName ?? session.me.profile.email }}
    </span>
    <button type="button" :class="BUTTON" @click="askSignOut">Sign out</button>
  </div>
</template>
