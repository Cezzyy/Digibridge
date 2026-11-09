<script setup lang="ts">
import { LESSON_TIERS, type LessonTier } from '@digibridge/shared'
import { computed } from 'vue'

// How far up an area's 3 lessons a tier sits, as 3 rising bars: Foundations fills one,
// Advanced all three. Decoration only: the tier's name is always written next to it. `on-green`
// for the evergreen panels.
const props = defineProps<{ tier: LessonTier; tone?: 'light' | 'on-green' }>()
const filled = computed(() => LESSON_TIERS.indexOf(props.tier) + 1)
</script>

<template>
  <span aria-hidden="true" class="inline-flex h-4 items-end gap-[3px]">
    <span
      v-for="(_, i) in LESSON_TIERS"
      :key="i"
      class="w-1.5 rounded-[2px]"
      :style="{ height: `${45 + i * 27.5}%` }"
      :class="
        tone === 'on-green'
          ? i < filled
            ? 'bg-marigold'
            : 'bg-white/25'
          : i < filled
            ? 'bg-evergreen'
            : 'bg-line'
      "
    />
  </span>
</template>
