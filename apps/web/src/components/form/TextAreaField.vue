<script setup lang="ts">
import { computed, useId } from 'vue'

// A labelled box for a few lines of text, like TextField: a hint above it, an error under it.
// With `maxlength`, a count of the characters used sits under it too.

const props = defineProps<{
  label: string
  hint?: string
  error?: string | null
  /** Lines shown before it scrolls; 3 if not set. */
  rows?: number
  maxlength?: number
}>()
const model = defineModel<string>({ required: true })

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
    <textarea
      :id="ids.input"
      v-model="model"
      :rows="rows ?? 3"
      :maxlength="maxlength"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="describedBy"
      class="mt-2 block w-full resize-y rounded-control border bg-surface px-4 py-3 text-lg leading-relaxed transition-colors hover:border-evergreen focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-evergreen"
      :class="error ? 'border-error' : 'border-line-strong'"
    />
    <div class="mt-2 flex justify-between gap-4">
      <p v-if="error" :id="ids.error" class="font-semibold text-error">{{ error }}</p>
      <p v-if="maxlength" class="ml-auto shrink-0 text-sm text-quiet tabular-nums">
        {{ model.length }} / {{ maxlength }}
      </p>
    </div>
  </div>
</template>
