<script setup lang="ts">
import { LEVEL_LABELS, type Level } from '@digibridge/shared'
import { LEVEL_TONE } from '../../lib/levels'

// A level's name on its own color (docs/design.md, "Levels"). `large` for the overall level.
defineProps<{ level: Level; large?: boolean }>()
</script>

<template>
  <span
    class="inline-flex w-fit shrink-0 items-center rounded-full font-display font-bold whitespace-nowrap"
    :class="[LEVEL_TONE[level], large ? 'px-4 py-1.5 text-2xl' : 'px-3 py-0.5 text-sm']"
  >
    {{ LEVEL_LABELS[level] }}
  </span>
</template>
