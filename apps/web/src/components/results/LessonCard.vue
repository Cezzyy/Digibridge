<script setup lang="ts">
import { LESSON_TIER_LABELS } from '@digibridge/shared'
import { computed } from 'vue'
import type { LessonPick } from '../../composables/useResult'

// One recommended lesson for an area: where to start, or the next step after it (RES-02).
// Until the team publishes the lesson for this tier, the card says it's coming and links nowhere.
const props = defineProps<{ pick: LessonPick }>()
const tier = computed(() => LESSON_TIER_LABELS[props.pick.tier])
</script>

<template>
  <RouterLink
    v-if="pick.lesson"
    :to="`/lessons/${pick.lesson.slug}`"
    class="group flex h-full flex-col rounded-card border border-line bg-surface p-4 transition-colors hover:border-evergreen hover:bg-evergreen-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-evergreen"
  >
    <p class="flex flex-wrap items-center gap-2 text-sm">
      <span
        class="rounded-full px-2.5 py-0.5 font-semibold"
        :class="
          pick.nextStep
            ? 'bg-marigold-soft text-marigold-text'
            : 'bg-evergreen-soft text-evergreen group-hover:bg-surface'
        "
      >
        {{ pick.nextStep ? 'Next step' : 'Start here' }}
      </span>
      <span class="text-quiet">{{ tier }} lesson</span>
    </p>
    <p class="mt-3 font-semibold text-evergreen">{{ pick.lesson.title }}</p>
    <p class="mt-1 leading-relaxed text-quiet">{{ pick.lesson.summary }}</p>
    <p class="mt-auto flex items-center gap-1.5 pt-3 text-sm font-semibold text-evergreen">
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
    class="flex h-full flex-col rounded-card border border-dashed border-line-strong/50 bg-mist-soft p-4"
  >
    <p class="flex flex-wrap items-center gap-2 text-sm">
      <span
        class="rounded-full px-2.5 py-0.5 font-semibold"
        :class="
          pick.nextStep ? 'bg-marigold-soft text-marigold-text' : 'bg-evergreen-soft text-evergreen'
        "
      >
        {{ pick.nextStep ? 'Next step' : 'Start here' }}
      </span>
    </p>
    <p class="mt-3 font-semibold">{{ tier }} lesson</p>
    <p class="mt-1 leading-relaxed text-quiet">Coming soon. The team is still writing it.</p>
  </div>
</template>
