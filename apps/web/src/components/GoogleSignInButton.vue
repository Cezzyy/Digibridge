<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useSessionStore } from '../stores/session'

const session = useSessionStore()
const redirecting = ref(false)

async function signIn() {
  redirecting.value = true
  await session.signIn()
  // Still here means Google's page didn't open.
  if (session.error) redirecting.value = false
}

// Back from Google's page: the browser may bring this page back as it was left, still
// "Opening Google…", so make the button usable again.
function onPageShow(event: PageTransitionEvent) {
  if (event.persisted) redirecting.value = false
}
onMounted(() => window.addEventListener('pageshow', onPageShow))
onBeforeUnmount(() => window.removeEventListener('pageshow', onPageShow))
</script>

<template>
  <button
    type="button"
    class="inline-flex min-h-13 items-center justify-center gap-3 rounded-control bg-evergreen px-4 text-base font-semibold text-white shadow-[0_10px_24px_-10px_rgb(30_91_68/0.7)] transition-colors hover:bg-evergreen-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-evergreen disabled:cursor-wait disabled:bg-evergreen-hover sm:px-6 sm:text-lg"
    :disabled="redirecting"
    @click="signIn"
  >
    <!-- Google's "G" sits on white, as Google's sign-in button rules ask. -->
    <span class="grid size-7 shrink-0 place-items-center rounded-full bg-white" aria-hidden="true">
      <svg
        v-if="redirecting"
        viewBox="0 0 24 24"
        class="size-4 fill-none stroke-evergreen stroke-[3] motion-safe:animate-spin"
      >
        <path d="M12 3a9 9 0 1 0 9 9" stroke-linecap="round" />
      </svg>
      <svg v-else viewBox="0 0 48 48" class="size-4">
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </svg>
    </span>
    {{ redirecting ? 'Opening Google…' : 'Continue with Google' }}
  </button>
</template>
