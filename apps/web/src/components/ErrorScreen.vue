<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { useSessionStore } from '../stores/session'
import AccountControls from './AccountControls.vue'
import SiteHeader from './SiteHeader.vue'

// A full screen for when a page can't be shown: not found, sign-in failed, API unreachable.
// Pages use it in place of their own content; the first action is the main button.
export interface ErrorAction {
  label: string
  /** A page to go to, or `onClick` for anything else (retry, sign out). */
  to?: RouteLocationRaw
  onClick?: () => void
}

defineProps<{
  title: string
  message: string
  actions: ErrorAction[]
}>()

// Signed-in users can still sign out from here, e.g. on the not-found page (AUTH-03).
const session = useSessionStore()

const BUTTON =
  'inline-flex min-h-12 items-center justify-center rounded-control px-6 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-evergreen'
const PRIMARY = `${BUTTON} bg-evergreen text-white hover:bg-evergreen-hover`
const SECONDARY = `${BUTTON} border border-line-strong text-evergreen hover:bg-evergreen-soft`
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <SiteHeader>
      <AccountControls v-if="session.isSignedIn" />
    </SiteHeader>
    <main class="grid flex-1 place-items-center px-4 py-12">
      <div class="flex max-w-md flex-col items-center text-center motion-safe:animate-rise">
        <span class="grid size-14 place-items-center rounded-full bg-error-soft" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            class="size-7 fill-none stroke-error stroke-2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5.5M12 16.5v.01" />
          </svg>
        </span>
        <h1 class="mt-5 text-3xl leading-tight font-bold tracking-[-0.02em] text-balance">
          {{ title }}
        </h1>
        <p class="mt-3 text-lg leading-relaxed text-pretty text-quiet">{{ message }}</p>

        <div class="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
          <template v-for="(action, i) in actions" :key="action.label">
            <RouterLink
              v-if="action.to"
              :to="action.to"
              :class="i === 0 ? PRIMARY : SECONDARY"
              @click="action.onClick?.()"
            >
              {{ action.label }}
            </RouterLink>
            <button
              v-else
              type="button"
              :class="i === 0 ? PRIMARY : SECONDARY"
              @click="action.onClick?.()"
            >
              {{ action.label }}
            </button>
          </template>
        </div>
      </div>
    </main>
  </div>
</template>
