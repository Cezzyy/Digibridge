<script setup lang="ts">
import { computed, useId } from 'vue'

// A labelled text box with an optional icon on the left (the `icon` slot, a 24 × 24 stroke
// icon), a hint, and an error under it. `valid` shows a green check on the right once the
// answer passes. `touch` fires on blur: the page shows the field's error from then on.

const props = defineProps<{
  label: string
  hint?: string
  error?: string | null
  valid?: boolean
  autocomplete?: string
  maxlength?: number
}>()
const model = defineModel<string>({ required: true })
const emit = defineEmits<{ touch: [] }>()
defineSlots<{ icon?: () => unknown }>()

const id = useId()
const ids = { input: `${id}-input`, hint: `${id}-hint`, error: `${id}-error` }
const describedBy = computed(
  () => [props.hint && ids.hint, props.error && ids.error].filter(Boolean).join(' ') || undefined,
)
</script>

<template>
  <div :data-invalid="error ? '' : undefined">
    <label :for="ids.input" class="text-lg font-semibold">{{ label }}</label>
    <p v-if="hint" :id="ids.hint" class="mt-0.5 text-quiet">{{ hint }}</p>
    <div class="relative mt-2">
      <svg
        v-if="$slots.icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        class="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 fill-none stroke-quiet stroke-[1.75]"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <slot name="icon" />
      </svg>
      <input
        :id="ids.input"
        v-model="model"
        type="text"
        :autocomplete="autocomplete"
        :maxlength="maxlength"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        class="block min-h-12 w-full rounded-control border bg-surface pr-12 text-lg transition-colors hover:border-evergreen focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-evergreen"
        :class="[error ? 'border-error' : 'border-line-strong', $slots.icon ? 'pl-11' : 'pl-4']"
        @blur="emit('touch')"
      />
      <span
        v-if="valid && !error"
        aria-hidden="true"
        class="pointer-events-none absolute top-1/2 right-3 grid size-6 -translate-y-1/2 place-items-center rounded-full bg-evergreen motion-safe:animate-pop"
      >
        <svg viewBox="0 0 16 16" class="size-4 fill-none stroke-white stroke-[2.5]">
          <path d="M3.5 8.5l3 3 6-7" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    </div>
    <p v-if="error" :id="ids.error" class="mt-2 font-semibold text-error">{{ error }}</p>
  </div>
</template>
