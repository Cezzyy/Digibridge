<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session'

// Top bar on every page, so users can sign out from anywhere (AUTH-03).
const session = useSessionStore()
const router = useRouter()

async function signOut() {
  await session.signOut()
  await router.push({ name: 'landing' })
}
</script>

<template>
  <header class="border-b border-line bg-surface">
    <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2">
      <RouterLink
        :to="{ name: 'landing' }"
        class="flex min-h-11 items-center font-display text-xl font-bold text-evergreen"
      >
        DigiBridge
      </RouterLink>

      <div v-if="session.isSignedIn && session.me" class="flex min-w-0 items-center gap-3">
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
    </div>
  </header>
</template>
