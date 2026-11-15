<script setup lang="ts" generic="T extends string">
import { computed, useId } from 'vue'

// A compact pick-one list for dialogs and tight spaces: small tiles in a grid, each a label
// around a real radio input (visually hidden, still focusable and clickable) with a round mark
// that fills when picked. Arrow keys move between them as with any radio group. For the
// roomier tiles with icons and hints on the start pages, use OptionGroup.

export type RadioOption<V> = { value: V; label: string }

const props = defineProps<{
  legend: string
  options: readonly RadioOption<T>[]
  error?: string | null
  /** Tiles per row; 2 if not set. */
  columns?: 1 | 2
  disabled?: boolean
}>()

/** The picked value, null until picked. */
const model = defineModel<T | null>({ required: true })

const id = useId()
const errorId = `${id}-error`
const describedBy = computed(() => (props.error ? errorId : undefined))
</script>

<template>
  <fieldset
    :aria-describedby="describedBy"
    :data-invalid="error ? '' : undefined"
    :disabled="disabled"
  >
    <legend class="font-semibold">{{ legend }}</legend>
    <div class="mt-2 grid gap-1.5" :class="columns === 1 ? '' : 'grid-cols-2'">
      <label
        v-for="option in options"
        :key="option.value"
        class="group flex min-h-10 cursor-pointer items-center gap-2.5 rounded-control border bg-surface px-2.5 py-1.5 text-sm leading-tight transition-[border-color,background-color,box-shadow] duration-200 hover:border-evergreen has-checked:border-evergreen has-checked:bg-evergreen-soft has-checked:shadow-[inset_0_0_0_1px_var(--color-evergreen)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-evergreen has-disabled:cursor-not-allowed has-disabled:opacity-60 has-disabled:hover:border-line"
        :class="error ? 'border-error' : 'border-line'"
      >
        <input v-model="model" type="radio" :name="id" :value="option.value" class="sr-only" />
        <span
          aria-hidden="true"
          class="grid size-4.5 shrink-0 place-items-center rounded-full border-2 border-line-strong bg-surface transition-colors duration-200 group-hover:border-evergreen group-has-checked:border-evergreen group-has-checked:bg-evergreen"
        >
          <span
            class="size-1.5 scale-0 rounded-full bg-on-evergreen transition duration-200 ease-glide group-has-checked:scale-100"
          />
        </span>
        <span class="min-w-0 flex-1 font-medium">{{ option.label }}</span>
      </label>
    </div>
    <p v-if="error" :id="errorId" class="mt-1.5 text-sm font-semibold text-error">{{ error }}</p>
  </fieldset>
</template>
