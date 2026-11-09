<script setup lang="ts">
import { LEVEL_LABELS, levelsForLessonTier, type LessonTier } from '@digibridge/shared'
import { computed } from 'vue'
import { LEVEL_FILL } from '../../lib/levels'

// "For Basic and Intermediate": the levels a lesson tier is meant for, each with a dot in its
// level color (docs/design.md, "Levels"). `ring` is the color the dots sit on, to part them.
const props = withDefaults(defineProps<{ tier: LessonTier; ring?: string }>(), {
  ring: 'ring-surface',
})
const levels = computed(() => levelsForLessonTier(props.tier))
</script>

<template>
  <span class="inline-flex items-center gap-2">
    <span class="flex -space-x-1" aria-hidden="true">
      <span
        v-for="level in levels"
        :key="level"
        class="size-3 rounded-full ring-2"
        :class="[LEVEL_FILL[level], ring]"
      />
    </span>
    For {{ levels.map((level) => LEVEL_LABELS[level]).join(' and ') }}
  </span>
</template>
