<script setup lang="ts" generic="T extends string | boolean">
import { computed, useId } from 'vue'

// A question answered by tapping tiles: one answer (`multiple` off, radio buttons) or several
// (checkboxes). Each tile is a full-width label around a real input, at least 48 px tall.
// `exclusive` is an answer that can only be picked on its own, like "None": picking it clears
// the others, and picking another clears it.

export type Option<V> = { value: V; label: string; hint?: string }

const props = defineProps<{
  legend: string
  hint?: string
  error?: string | null
  options: readonly Option<T>[]
  multiple?: boolean
  exclusive?: T
  columns?: 1 | 2 | 3
}>()

/** The picked value (`multiple` off, null until picked) or the picked values. */
const model = defineModel<T | T[] | null>({ required: true })

const id = useId()
const hintId = `${id}-hint`
const errorId = `${id}-error`
const describedBy = computed(
  () => [props.hint && hintId, props.error && errorId].filter(Boolean).join(' ') || undefined,
)

const COLUMNS = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' } as const

const picks = () => (Array.isArray(model.value) ? model.value : [])

const isPicked = (value: T) => (props.multiple ? picks().includes(value) : model.value === value)

function pick(value: T, checked: boolean) {
  if (!props.multiple) {
    model.value = value
    return
  }
  if (!checked) model.value = picks().filter((p) => p !== value)
  else if (value === props.exclusive) model.value = [value]
  else model.value = [...picks().filter((p) => p !== props.exclusive), value]
}
</script>

<template>
  <fieldset :aria-describedby="describedBy" :data-invalid="error ? '' : undefined">
    <legend class="text-lg font-semibold">{{ legend }}</legend>
    <p v-if="hint" :id="hintId" class="mt-0.5 text-quiet">{{ hint }}</p>
    <div class="mt-3 grid gap-2" :class="COLUMNS[columns ?? 1]">
      <label
        v-for="option in options"
        :key="String(option.value)"
        class="flex min-h-12 cursor-pointer items-center gap-3 rounded-control border bg-surface px-4 py-3 transition-colors hover:border-evergreen has-checked:border-evergreen has-checked:bg-evergreen-soft has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-evergreen"
        :class="error ? 'border-error' : 'border-line-strong'"
      >
        <input
          :type="multiple ? 'checkbox' : 'radio'"
          :name="id"
          :checked="isPicked(option.value)"
          class="size-5 shrink-0 accent-evergreen focus:outline-none"
          @change="pick(option.value, ($event.target as HTMLInputElement).checked)"
        />
        <span class="min-w-0">
          <span class="block leading-snug font-semibold">{{ option.label }}</span>
          <span v-if="option.hint" class="mt-0.5 block text-sm leading-snug text-quiet">
            {{ option.hint }}
          </span>
        </span>
      </label>
    </div>
    <p v-if="error" :id="errorId" class="mt-2 font-semibold text-error">{{ error }}</p>
  </fieldset>
</template>
