<script setup lang="ts">
import type { Level } from '@digibridge/shared'
import { LEVEL_BANDS, LEVEL_TONE } from '../../lib/levels'

// One area's score as a bar on its level's color, with a tick where each level starts (40, 60,
// 80), so it shows how close the next level is. Only a picture: the text beside it says the same.
defineProps<{ pct: number; level: Level }>()
const CUTOFFS = LEVEL_BANDS.slice(1).map((band) => band.from)
</script>

<template>
  <div class="relative h-2.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
    <div
      class="grow-bar h-full origin-left rounded-full"
      :class="LEVEL_TONE[level]"
      :style="{ width: `${pct}%` }"
    />
    <span
      v-for="cut in CUTOFFS"
      :key="cut"
      class="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-surface"
      :style="{ left: `${cut}%` }"
    />
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .grow-bar {
    animation: grow 0.9s var(--ease-glide) 0.2s both;
  }
}

@keyframes grow {
  from {
    scale: 0 1;
  }
}
</style>
