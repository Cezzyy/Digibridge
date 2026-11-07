<script setup lang="ts">
import { ref } from 'vue'
import { useSessionStore } from '../stores/session'

const session = useSessionStore()
const redirecting = ref(false)

async function signIn() {
  redirecting.value = true
  await session.signIn()
  // Still here means Google's page didn't open.
  if (session.error) redirecting.value = false
}
</script>

<template>
  <button
    type="button"
    class="min-h-11 rounded-control bg-evergreen px-6 font-semibold text-white hover:bg-evergreen-hover disabled:opacity-70"
    :disabled="redirecting"
    @click="signIn"
  >
    {{ redirecting ? 'Opening Google…' : 'Sign in with Google' }}
  </button>
</template>
