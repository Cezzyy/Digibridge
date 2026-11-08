<script setup lang="ts" generic="T extends string | boolean">
import { computed, useId } from 'vue'
import type { ChoiceIcon } from './choice-icons'

// A question answered by tapping tiles: one answer (`multiple` off, radio buttons) or several
// (checkboxes). Each tile is a label around a real input, which is visually hidden but still
// takes focus and clicks; the round (one answer) or square (several) mark on the right shows
// what's picked. Tiles are at least 56 px tall. `exclusive` is an answer that can only be
// picked on its own, like "None": picking it clears the others, picking another clears it,
// and its tile spans the whole row.

export type Option<V> = { value: V; label: string; hint?: string; icon?: ChoiceIcon }

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
    <div class="mt-3 grid gap-2.5" :class="COLUMNS[columns ?? 1]">
      <label
        v-for="option in options"
        :key="String(option.value)"
        class="group flex min-h-14 cursor-pointer items-center gap-3 rounded-control border bg-surface px-3.5 py-3 transition-[border-color,background-color,box-shadow] duration-200 hover:border-evergreen has-checked:border-evergreen has-checked:bg-evergreen-soft has-checked:shadow-[inset_0_0_0_1px_var(--color-evergreen)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-evergreen"
        :class="[
          error ? 'border-error' : 'border-line',
          exclusive !== undefined && option.value === exclusive && 'col-span-full',
        ]"
      >
        <input
          :type="multiple ? 'checkbox' : 'radio'"
          :name="id"
          :checked="isPicked(option.value)"
          class="sr-only"
          @change="pick(option.value, ($event.target as HTMLInputElement).checked)"
        />
        <span
          v-if="option.icon"
          aria-hidden="true"
          class="grid size-10 shrink-0 place-items-center rounded-control bg-mist-soft text-evergreen transition-colors duration-200 group-has-checked:bg-evergreen group-has-checked:text-white"
        >
          <svg
            viewBox="0 0 24 24"
            class="size-6 fill-none stroke-current stroke-[1.75]"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path v-for="d in option.icon" :key="d" :d="d" />
          </svg>
        </span>
        <span class="min-w-0 flex-1">
          <span class="block leading-snug font-semibold">{{ option.label }}</span>
          <span v-if="option.hint" class="mt-0.5 block text-sm leading-snug text-quiet">
            {{ option.hint }}
          </span>
        </span>
        <span
          aria-hidden="true"
          class="grid size-6 shrink-0 place-items-center border-2 border-line-strong bg-surface transition-colors duration-200 group-hover:border-evergreen group-has-checked:border-evergreen group-has-checked:bg-evergreen"
          :class="multiple ? 'rounded-md' : 'rounded-full'"
        >
          <svg
            v-if="multiple"
            viewBox="0 0 16 16"
            class="size-4 scale-50 fill-none stroke-white stroke-[2.5] opacity-0 transition duration-200 ease-glide group-has-checked:scale-100 group-has-checked:opacity-100"
          >
            <path d="M3.5 8.5l3 3 6-7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span
            v-else
            class="size-2.5 scale-0 rounded-full bg-white transition duration-200 ease-glide group-has-checked:scale-100"
          />
        </span>
      </label>
    </div>
    <p v-if="error" :id="errorId" class="mt-2 font-semibold text-error">{{ error }}</p>
  </fieldset>
</template>
