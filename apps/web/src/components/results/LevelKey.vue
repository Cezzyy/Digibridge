<script setup lang="ts">
import { LEVEL_LABELS, type Level } from '@digibridge/shared'
import { LEVEL_BANDS, levelRange } from '../../lib/levels'

// The key to the radar chart's rings: each level's color and score range. Shared by the chart
// and its loading placeholder, so the key is already in place while the scores load.
const SWATCH = {
  beginner: 'bg-level-1',
  basic: 'bg-level-2',
  intermediate: 'bg-level-3',
  advanced: 'bg-level-4',
} as const satisfies Record<Level, string>
</script>

<template>
  <span class="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
    <span v-for="band in LEVEL_BANDS" :key="band.level" class="flex items-center gap-2">
      <span
        aria-hidden="true"
        class="size-3.5 rounded-full ring-1 ring-line-strong/40 ring-inset"
        :class="SWATCH[band.level]"
      />
      <span class="flex gap-1.5">
        <span class="font-semibold">{{ LEVEL_LABELS[band.level] }}</span>
        <span class="text-quiet">{{ levelRange(band) }}</span>
      </span>
    </span>
  </span>
</template>
