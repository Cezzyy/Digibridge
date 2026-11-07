<script setup lang="ts">
import { vReveal } from '../../lib/motion'

// The small label above each landing section's heading. Its rule draws itself as the label
// scrolls in. Set the color with a text class, e.g. `class="text-evergreen"`.
</script>

<template>
  <p v-reveal class="flex items-center gap-3 font-semibold">
    <span class="rule h-px w-8 bg-current" aria-hidden="true" />
    <slot />
  </p>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  [data-revealed] > .rule {
    transform-origin: left;
    animation: draw 0.8s var(--ease-glide) 0.25s both;
  }
}

@keyframes draw {
  from {
    scale: 0 1;
  }
}
</style>
