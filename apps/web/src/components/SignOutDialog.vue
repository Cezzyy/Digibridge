<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useSignOut } from '../composables/useSignOut'
import ConfirmDialog from './ConfirmDialog.vue'

// The "Sign out?" check behind every Sign out button (`askSignOut`). Mounted once, in App.vue.
const { asking, signingOut, cancel, confirm } = useSignOut()
const route = useRoute()

// Mid-assessment the timer keeps running on the server, so say so.
const message = computed(() =>
  route.name === 'assessment'
    ? 'Your answers so far are saved, but the timer keeps running while you’re signed out. Sign in again with the same Google account to continue.'
    : 'You’ll need to sign in again with Google to come back.',
)
</script>

<template>
  <ConfirmDialog
    :open="asking"
    title="Sign out?"
    :message="message"
    confirm-label="Sign out"
    busy-label="Signing out…"
    :busy="signingOut"
    :error="null"
    @confirm="confirm"
    @close="cancel"
  />
</template>
