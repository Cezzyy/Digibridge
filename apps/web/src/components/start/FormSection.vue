<script setup lang="ts">
import { useId } from 'vue'

// One card of a long form: a numbered heading, a line on why we ask, then the questions.
defineProps<{ number: number; title: string; description?: string }>()
const id = useId()
</script>

<template>
  <section :aria-labelledby="id" class="rounded-card border border-line bg-surface p-5 sm:p-7">
    <div class="flex items-center gap-3">
      <span
        aria-hidden="true"
        class="grid size-8 shrink-0 place-items-center rounded-full bg-evergreen-soft font-display font-bold text-evergreen"
      >
        {{ number }}
      </span>
      <h2 :id="id" class="text-xl leading-tight font-bold tracking-[-0.01em]">{{ title }}</h2>
    </div>
    <p v-if="description" class="mt-2 text-quiet sm:pl-11">{{ description }}</p>
    <div class="mt-6 space-y-8">
      <slot />
    </div>
  </section>
</template>
