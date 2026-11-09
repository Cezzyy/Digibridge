<script setup lang="ts">
import {
  LESSON_TIER_LABELS,
  LEVEL_LABELS,
  levelsForLessonTier,
  type LessonTier,
} from '@digibridge/shared'
import { computed } from 'vue'
import type { LessonSummary } from '../../composables/useLessons'

// One lesson tier of an area in the library: its tier, the levels it's meant for, and a link to
// the lesson. `lesson` is null until the team publishes that tier's lesson. `current` marks the
// lesson already open, on its own page, where it isn't a link.
const props = defineProps<{ tier: LessonTier; lesson: LessonSummary | null; current?: boolean }>()

const tierLabel = computed(() => LESSON_TIER_LABELS[props.tier])
const forLevels = computed(
  () =>
    `For ${levelsForLessonTier(props.tier)
      .map((level) => LEVEL_LABELS[level])
      .join(' and ')}`,
)
</script>

<template>
  <div
    v-if="lesson && current"
    aria-current="page"
    class="flex h-full flex-col rounded-card border-2 border-evergreen bg-evergreen-soft p-4"
  >
    <p class="flex flex-wrap items-center gap-2 text-sm">
      <span class="rounded-full bg-evergreen px-2.5 py-0.5 font-semibold text-white">
        {{ tierLabel }}
      </span>
      <span class="text-quiet">You’re reading this</span>
    </p>
    <p class="mt-3 font-semibold text-evergreen">{{ lesson.title }}</p>
  </div>

  <RouterLink
    v-else-if="lesson"
    :to="{ name: 'lesson', params: { slug: lesson.slug } }"
    class="group flex h-full flex-col rounded-card border border-line bg-surface p-4 transition-colors hover:border-evergreen hover:bg-evergreen-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-evergreen sm:p-5"
  >
    <p class="flex flex-wrap items-center gap-2 text-sm">
      <span
        class="rounded-full bg-evergreen-soft px-2.5 py-0.5 font-semibold text-evergreen group-hover:bg-surface"
      >
        {{ tierLabel }}
      </span>
      <span class="text-quiet">{{ forLevels }}</span>
    </p>
    <p class="mt-3 text-lg leading-snug font-semibold text-evergreen">{{ lesson.title }}</p>
    <p class="mt-1 leading-relaxed text-quiet">{{ lesson.summary }}</p>
    <p class="mt-auto flex items-center gap-1.5 pt-4 text-sm font-semibold text-evergreen">
      Open lesson
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        class="size-4 fill-none stroke-current stroke-[2.5] transition-transform group-hover:translate-x-0.5"
      >
        <path d="M6 3.5 10.5 8 6 12.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </p>
  </RouterLink>

  <div
    v-else
    class="flex h-full flex-col rounded-card border border-dashed border-line-strong/50 bg-mist-soft p-4 sm:p-5"
  >
    <p class="flex flex-wrap items-center gap-2 text-sm">
      <span class="rounded-full bg-evergreen-soft px-2.5 py-0.5 font-semibold text-evergreen">
        {{ tierLabel }}
      </span>
      <span class="text-quiet">{{ forLevels }}</span>
    </p>
    <p class="mt-3 text-lg font-semibold">{{ tierLabel }} lesson</p>
    <p class="mt-1 leading-relaxed text-quiet">Coming soon. The team is still writing it.</p>
  </div>
</template>
