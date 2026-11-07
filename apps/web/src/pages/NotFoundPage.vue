<script setup lang="ts">
import ErrorScreen from '../components/ErrorScreen.vue'
</script>

<template>
  <ErrorScreen
    title="Page not found"
    message="This page doesn't exist. It may have moved."
    :actions="[{ label: 'Go to the home page', to: { name: 'landing' } }]"
  />
</template>
