<script setup lang="ts">
import { useId } from 'vue'

// One part of a long form, as a row of a panel split by lines (the form puts the rows in one
// panel). The numbered title and why we ask sit above the questions, or on the left of them from
// 2xl, where they stay in view while the questions scroll. The number turns into a check mark
// once every question in the part is answered (`done`). `stacked` keeps the title above the
// questions on every screen, for a form that only gets half the width (the lessons editor).
defineProps<{
  number: number
  title: string
  description?: string
  done?: boolean
  stacked?: boolean
}>()
const id = useId()
</script>

<template>
  <section
    :aria-labelledby="id"
    class="px-5 py-6 sm:px-7 sm:py-7"
    :class="!stacked && '2xl:grid 2xl:grid-cols-[15rem_minmax(0,1fr)] 2xl:gap-10'"
  >
    <div
      :class="!stacked && '2xl:sticky 2xl:top-[calc(var(--spacing-header)+1.5rem)] 2xl:self-start'"
    >
      <div class="flex items-center gap-3" :class="!stacked && '2xl:items-start'">
        <span
          aria-hidden="true"
          class="grid size-10 shrink-0 place-items-center rounded-control font-display font-bold transition-colors duration-300"
          :class="done ? 'bg-evergreen text-on-evergreen' : 'bg-evergreen-soft text-evergreen'"
        >
          <svg
            v-if="done"
            viewBox="0 0 16 16"
            class="size-4 fill-none stroke-current stroke-[2.5] motion-safe:animate-pop"
          >
            <path d="M3.5 8.5l3 3 6-7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <template v-else>{{ number }}</template>
        </span>
        <h3
          :id="id"
          class="text-xl leading-snug font-bold tracking-[-0.01em]"
          :class="!stacked && '2xl:pt-1.5'"
        >
          {{ title }}
        </h3>
      </div>
      <p
        v-if="description"
        class="mt-2 text-quiet sm:pl-13"
        :class="!stacked && '2xl:mt-3 2xl:pl-0'"
      >
        {{ description }}
      </p>
    </div>
    <div class="mt-6 space-y-8" :class="!stacked && '2xl:mt-0 2xl:pt-1.5'">
      <slot />
    </div>
  </section>
</template>
