<script setup lang="ts">
import AppHeader from './components/AppHeader.vue'
import { useSessionStore } from './stores/session'

// Load the session for every page, including public ones that have no guard.
void useSessionStore().init()
</script>

<template>
  <AppHeader />
  <RouterView />
</template>
