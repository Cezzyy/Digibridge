<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session'

// The signed-in user's picture, name and Sign out button, for every top bar that a signed-in
// user can see (AUTH-03). Shows nothing when signed out.
const session = useSessionStore()
const router = useRouter()

async function signOut() {
  await session.signOut()
  await router.push({ name: 'landing' })
}
</script>

<template>
  <div v-if="session.me" class="flex min-w-0 items-center gap-3">
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
    <button
      type="button"
      class="min-h-11 shrink-0 rounded-control border border-line-strong px-4 font-semibold text-evergreen hover:bg-evergreen-soft"
      @click="signOut"
    >
      Sign out
    </button>
  </div>
</template>
