<script setup lang="ts">
import { computed } from 'vue'
import { STEPS } from '../landing/steps'

// Where the respondent is on the way from sign-in to lessons: the same steps the landing and
// sign-in pages list, with the ones before this page marked done. Made for StartLayout's green
// panel. Phones, tablets and most laptops show "Step 2 of 5", the step's name and a bar per step;
// desktops with tall screens (`tall:`) show the whole list with the current step's line.
export type StartStep = 'consent' | 'profile'

const props = defineProps<{ current: StartStep }>()
const index = computed(() => STEPS.findIndex((step) => step.screen === props.current))
const LAST = STEPS.length - 1
</script>

<template>
  <div>
    <div class="lg:tall:hidden">
      <p class="flex flex-wrap gap-x-1.5 text-sm font-semibold text-white/80">
        <span>Step {{ index + 1 }} of {{ STEPS.length }}</span>
        <span aria-hidden="true">·</span>
        <span class="text-white">{{ STEPS[index]?.title }}</span>
      </p>
      <ol class="mt-2.5 flex gap-1.5" aria-hidden="true">
        <li
          v-for="(step, i) in STEPS"
          :key="step.screen"
          class="h-1.5 flex-1 rounded-full"
          :class="i < index ? 'bg-white' : i === index ? 'bg-marigold' : 'bg-white/20'"
        />
      </ol>
    </div>

    <ol class="hidden lg:tall:block" aria-label="Your steps">
      <li
        v-for="(step, i) in STEPS"
        :key="step.screen"
        :aria-current="i === index ? 'step' : undefined"
        class="relative flex gap-4 pb-5 last:pb-0"
      >
        <span
          v-if="i < LAST"
          aria-hidden="true"
          class="absolute top-10 bottom-1 left-4 w-0.5 -translate-x-1/2 rounded-full"
          :class="i < index ? 'bg-white/60' : 'bg-white/15'"
        />
        <span
          aria-hidden="true"
          class="relative grid size-8 shrink-0 place-items-center rounded-full border-2 font-display text-sm font-bold"
          :class="
            i < index
              ? 'border-white bg-white text-evergreen'
              : i === index
                ? 'border-marigold bg-marigold text-ink'
                : 'border-white/30 text-white/70'
          "
        >
          <span
            v-if="i === index"
            class="pulse absolute -inset-0.5 rounded-full border-2 border-marigold"
          />
          <svg
            v-if="i < index"
            viewBox="0 0 16 16"
            class="size-4 fill-none stroke-current stroke-[2.5]"
          >
            <path d="M3.5 8.5l3 3 6-7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <template v-else>{{ i + 1 }}</template>
        </span>
        <div class="min-w-0 pt-1">
          <p class="leading-snug font-semibold" :class="i > index && 'text-white/75'">
            {{ step.title }}
            <span v-if="i < index" class="sr-only">(done)</span>
          </p>
          <p v-if="i === index" class="mt-0.5 text-sm leading-relaxed text-white/80">
            {{ step.body }}
          </p>
        </div>
      </li>
    </ol>
  </div>
</template>

<style scoped>
/* The current step's ring breathes, like the sign-in page's list. */
@media (prefers-reduced-motion: no-preference) {
  .pulse {
    animation: pulse 2.4s ease-out infinite;
  }
}

@keyframes pulse {
  from {
    opacity: 0.6;
    scale: 1;
  }
  to {
    opacity: 0;
    scale: 1.5;
  }
}
</style>
