<script setup lang="ts">
import { LESSON_TIER_LABELS, type LessonTier } from '@digibridge/shared'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { LessonSummary } from '../../composables/useLessons'
import LevelDots from './LevelDots.vue'
import TierMeter from './TierMeter.vue'

// One lesson tier of an area: its tier and how far up the area it sits, the lesson's title and
// summary, and the levels it's meant for (LevelDots). `lesson` is null until the
// team publishes that tier's lesson. `current` marks the lesson already open, on its own page,
// where it isn't a link.
const props = defineProps<{ tier: LessonTier; lesson: LessonSummary | null; current?: boolean }>()

const tierLabel = computed(() => LESSON_TIER_LABELS[props.tier])
</script>

<template>
  <component
    :is="lesson && !current ? RouterLink : 'div'"
    :to="lesson && !current ? { name: 'lesson', params: { slug: lesson.slug } } : undefined"
    :aria-current="lesson && current ? 'page' : undefined"
    class="group flex h-full flex-col rounded-card p-5 sm:p-6"
    :class="
      !lesson
        ? 'border border-dashed border-line-strong/50 bg-mist-soft'
        : current
          ? 'border-2 border-evergreen bg-evergreen-soft'
          : 'border border-line bg-surface transition-[border-color,box-shadow,translate] duration-300 ease-glide hover:-translate-y-0.5 hover:border-evergreen hover:shadow-[0_18px_36px_-24px_rgb(18_36_28/0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-evergreen'
    "
  >
    <p class="flex items-center justify-between gap-3 text-sm font-semibold">
      <span :class="lesson ? 'text-evergreen' : 'text-quiet'">{{ tierLabel }}</span>
      <TierMeter :tier="tier" :class="!lesson && 'opacity-50'" />
    </p>

    <template v-if="lesson">
      <h3
        class="mt-4 text-xl leading-tight font-bold text-balance"
        :class="current ? 'text-evergreen' : 'transition-colors group-hover:text-evergreen'"
      >
        {{ lesson.title }}
      </h3>
      <p v-if="!current" class="mt-2 leading-relaxed text-quiet">{{ lesson.summary }}</p>
    </template>
    <template v-else>
      <h3 class="mt-4 text-xl leading-tight font-bold">{{ tierLabel }} lesson</h3>
      <p class="mt-2 leading-relaxed text-quiet">Coming soon. The team is still writing it.</p>
    </template>

    <div class="mt-auto pt-5">
      <div
        class="flex min-h-9 items-center justify-between gap-3"
        :class="!current && 'border-t border-line pt-4'"
      >
        <p v-if="current" class="text-sm font-semibold text-evergreen">You’re reading this</p>
        <LevelDots
          v-else
          :tier="tier"
          :ring="lesson ? 'ring-surface' : 'ring-mist-soft'"
          class="text-sm text-quiet"
        />
        <span
          v-if="lesson && !current"
          aria-hidden="true"
          class="grid size-9 shrink-0 place-items-center rounded-full bg-evergreen-soft text-evergreen transition-colors group-hover:bg-evergreen group-hover:text-white"
        >
          <svg
            viewBox="0 0 16 16"
            class="size-4 fill-none stroke-current stroke-[2.25] transition-transform group-hover:translate-x-0.5"
          >
            <path d="M3 8h9.5M8.5 4l4 4-4 4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      </div>
    </div>
  </component>
</template>
