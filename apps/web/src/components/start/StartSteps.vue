<script setup lang="ts">
import { computed } from 'vue'

// Where the respondent is before the assessment: "Step 1 of 2", the step's name and a bar per
// step. The instructions page joins this list when it's built.
export type StartStep = 'consent' | 'profile'

const STEPS: readonly { id: StartStep; label: string }[] = [
  { id: 'consent', label: 'Privacy notice' },
  { id: 'profile', label: 'Your profile' },
]

const props = defineProps<{ current: StartStep }>()
const index = computed(() => STEPS.findIndex((step) => step.id === props.current))
</script>

<template>
  <div>
    <p class="flex gap-1.5 text-sm font-semibold text-quiet">
      <span>Step {{ index + 1 }} of {{ STEPS.length }}</span>
      <span aria-hidden="true">·</span>
      <span class="text-evergreen">{{ STEPS[index]?.label }}</span>
    </p>
    <ol class="mt-2 flex gap-1.5" aria-hidden="true">
      <li
        v-for="(step, i) in STEPS"
        :key="step.id"
        class="h-1.5 flex-1 rounded-full"
        :class="i <= index ? 'bg-evergreen' : 'bg-track'"
      />
    </ol>
  </div>
</template>
