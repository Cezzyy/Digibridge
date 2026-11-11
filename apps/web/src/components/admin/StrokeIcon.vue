<script setup lang="ts">
// A line icon on a 24 px grid, drawn in the text color. Size it with a class (`size-5`).
defineProps<{ d: string | readonly string[] }>()
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    class="shrink-0 fill-none stroke-current stroke-[1.75]"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path v-for="path in [d].flat()" :key="path" :d="path" />
  </svg>
</template>
