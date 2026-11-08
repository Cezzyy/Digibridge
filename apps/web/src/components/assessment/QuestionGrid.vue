<script setup lang="ts">
import type { SaveState } from '../../stores/attempt'

// A numbered button per question, marking which have an answer, to jump to any of them (ASM-05).
// The one on screen has a marigold ring; a red cell is an answer that didn't save.
defineProps<{
  itemIds: readonly string[]
  answers: Readonly<Record<string, string>>
  saveStates: Readonly<Record<string, SaveState>>
  current: number
}>()
defineEmits<{ jump: [index: number] }>()
</script>

<template>
  <nav aria-label="Questions">
    <ol class="grid grid-cols-6 gap-1.5 sm:grid-cols-10 lg:grid-cols-6">
      <li v-for="(id, i) in itemIds" :key="id">
        <button
          type="button"
          :aria-current="i === current ? 'step' : undefined"
          :aria-label="`Question ${i + 1}, ${answers[id] ? 'answered' : 'not answered'}${saveStates[id] === 'failed' ? ', not saved' : ''}`"
          class="grid aspect-square min-h-11 w-full place-items-center rounded-control border text-sm font-semibold tabular-nums transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-evergreen"
          :class="[
            saveStates[id] === 'failed'
              ? 'border-error bg-error-soft text-error'
              : answers[id]
                ? 'border-evergreen bg-evergreen text-white hover:bg-evergreen-hover'
                : 'border-line-strong bg-surface text-ink hover:border-evergreen hover:bg-evergreen-soft',
            i === current && 'ring-2 ring-marigold ring-offset-2 ring-offset-surface',
          ]"
          @click="$emit('jump', i)"
        >
          {{ i + 1 }}
        </button>
      </li>
    </ol>
    <ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-quiet" aria-hidden="true">
      <li class="flex items-center gap-1.5">
        <span class="size-3 rounded-sm bg-evergreen" /> Answered
      </li>
      <li class="flex items-center gap-1.5">
        <span class="size-3 rounded-sm border border-line-strong bg-surface" /> Not answered
      </li>
      <li class="flex items-center gap-1.5">
        <span class="size-3 rounded-sm ring-2 ring-marigold" /> On screen
      </li>
    </ul>
  </nav>
</template>
