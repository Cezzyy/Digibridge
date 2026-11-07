<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import { useSessionStore } from './stores/session'

// Load the session for every page, including public ones that have no guard.
void useSessionStore().init()

// Wait for the first page to resolve, so the landing page doesn't flash AppHeader first.
const route = useRoute()
const showHeader = computed(() => route.matched.length > 0 && !route.meta.hideHeader)
</script>

<template>
  <AppHeader v-if="showHeader" />
  <RouterView />
</template>
