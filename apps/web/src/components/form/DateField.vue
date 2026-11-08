<script setup lang="ts">
import { toIsoDate } from '@digibridge/shared'
import { onBeforeUnmount, ref, useId, useTemplateRef, watch } from 'vue'
import CalendarPanel from './CalendarPanel.vue'

// A date typed as MM/DD/YYYY or picked on a calendar (CalendarPanel). Typing adds the slashes;
// "6/" typed at the end becomes "06", and a browser's YYYY-MM-DD autofill is turned around.
// A fix in the middle of the date keeps the caret where it was and never adds a 0.
//
// The model is `YYYY-MM-DD` once all eight digits are in, even for a date that doesn't exist
// (02/30), so the schema can say what's wrong; null when empty; and the typed text while it's
// unfinished, which fails the schema's format check. `touch` fires when focus leaves the field
// and its calendar, or a date is picked: the page shows the field's error from then on.

const props = defineProps<{
  label: string
  hint?: string
  error?: string | null
  /** Shown in green under the field when there's no error, like "You're 19 years old." */
  confirmation?: string | null
  min: string
  max: string
  startYear: number
}>()
const model = defineModel<string | null>({ required: true })
const emit = defineEmits<{ touch: [] }>()

const id = useId()
const ids = {
  input: `${id}-input`,
  hint: `${id}-hint`,
  error: `${id}-error`,
  confirmation: `${id}-confirmation`,
  panel: `${id}-calendar`,
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/
const toText = (date: string) => {
  const match = ISO.exec(date)
  return match ? `${match[2]}/${match[3]}/${match[1]}` : date
}

// `padShort` adds the 0 to a one-digit month or day before a slash ("6/" to "06"). Only for
// typing or pasting at the end: in the middle, deleting the 5 of 06/15 would make it 06/01.
function format(raw: string, padShort: boolean) {
  const autofill = ISO.exec(raw.trim())
  if (autofill) return toText(raw.trim())
  const parts = raw.replace(/[^\d/]/g, '').split('/')
  const digits = parts
    .map((part, i) =>
      padShort && i < 2 && i < parts.length - 1 && part.length === 1 ? `0${part}` : part,
    )
    .join('')
    .slice(0, 8)
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/')
}

/** The position just after the `count`th digit of `text`. */
function afterDigit(text: string, count: number) {
  if (count === 0) return 0
  let seen = 0
  for (let i = 0; i < text.length; i++) {
    if (/\d/.test(text.charAt(i)) && ++seen === count) return i + 1
  }
  return text.length
}

const text = ref(model.value ? toText(model.value) : '')

function onInput(event: Event) {
  const input = event.target as HTMLInputElement
  const caret = input.selectionStart ?? input.value.length
  const atEnd = caret === input.value.length
  const formatted = format(input.value, atEnd)
  if (input.value !== formatted) {
    const digitsBefore = input.value.slice(0, caret).replace(/\D/g, '').length
    // Writing the value moves the caret to the end; put it back after the same digit.
    input.value = formatted
    if (!atEnd) {
      const position = afterDigit(formatted, digitsBefore)
      input.setSelectionRange(position, position)
    }
  }
  text.value = formatted
  const digits = formatted.replace(/\D/g, '')
  model.value =
    digits.length === 0
      ? null
      : digits.length === 8
        ? toIsoDate(Number(digits.slice(4)), Number(digits.slice(0, 2)), Number(digits.slice(2, 4)))
        : formatted
}

// A date set from outside (or picked) shows in the box.
watch(model, (value) => {
  if (value === null) text.value = ''
  else if (ISO.test(value) && toText(value) !== text.value) text.value = toText(value)
})

const open = ref(false)
const root = useTemplateRef<HTMLElement>('root')
const toggle = useTemplateRef<HTMLButtonElement>('toggle')

function close(returnFocus: boolean) {
  open.value = false
  if (returnFocus) toggle.value?.focus()
}

function onPick(date: string) {
  model.value = date
  close(true)
  emit('touch')
}

// Focus going nowhere while the calendar is open means its focused button was replaced (a year
// or month was picked), not that the student left: the tap-outside handler covers leaving.
function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (next && root.value?.contains(next)) return
  if (open.value && !next) return
  open.value = false
  emit('touch')
}

// A tap anywhere else closes the calendar.
function onOutside(event: PointerEvent) {
  if (root.value?.contains(event.target as Node)) return
  close(false)
  emit('touch')
}
watch(open, (isOpen) => {
  if (isOpen) document.addEventListener('pointerdown', onOutside)
  else document.removeEventListener('pointerdown', onOutside)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside))

const describedBy = () =>
  [
    props.hint && ids.hint,
    props.error && ids.error,
    !props.error && props.confirmation && ids.confirmation,
  ]
    .filter(Boolean)
    .join(' ') || undefined
</script>

<template>
  <div ref="root" :data-invalid="error ? '' : undefined" @focusout="onFocusOut">
    <label :for="ids.input" class="text-lg font-semibold">{{ label }}</label>
    <p v-if="hint" :id="ids.hint" class="mt-0.5 text-quiet">{{ hint }}</p>
    <div class="relative mt-2">
      <input
        :id="ids.input"
        :value="text"
        type="text"
        inputmode="numeric"
        autocomplete="bday"
        placeholder="MM/DD/YYYY"
        maxlength="10"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy()"
        class="block min-h-12 w-full rounded-control border bg-surface pr-14 pl-4 text-lg tracking-wide tabular-nums transition-colors placeholder:tracking-normal placeholder:text-quiet hover:border-evergreen focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-evergreen"
        :class="error ? 'border-error' : 'border-line-strong'"
        @input="onInput"
        @keydown.esc="close(false)"
        @keydown.alt.down.prevent="open = true"
      />
      <button
        ref="toggle"
        type="button"
        :aria-expanded="open"
        :aria-controls="ids.panel"
        :aria-label="open ? 'Close the calendar' : 'Pick from a calendar'"
        class="absolute top-1/2 right-1.5 grid size-10 -translate-y-1/2 place-items-center rounded-md text-evergreen transition-colors hover:bg-evergreen-soft focus-visible:outline-2 focus-visible:outline-evergreen"
        :class="open && 'bg-evergreen-soft'"
        @click="open = !open"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          class="size-6 fill-none stroke-current stroke-[1.75]"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
          <path d="M3 10h18M8 3v4M16 3v4" />
          <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" />
        </svg>
      </button>

      <Transition
        enter-active-class="motion-safe:transition motion-safe:duration-200 motion-safe:ease-glide"
        enter-from-class="opacity-0 -translate-y-1 scale-[0.98]"
        leave-active-class="motion-safe:transition motion-safe:duration-150"
        leave-to-class="opacity-0"
      >
        <CalendarPanel
          v-if="open"
          :id="ids.panel"
          :value="model"
          :min="min"
          :max="max"
          :start-year="startYear"
          :label="label"
          class="absolute top-full left-0 z-20 mt-2 origin-top-left"
          @pick="onPick"
          @close="close(true)"
        />
      </Transition>
    </div>
    <p v-if="error" :id="ids.error" class="mt-2 font-semibold text-error">{{ error }}</p>
    <p
      v-else-if="confirmation"
      :id="ids.confirmation"
      class="mt-2 flex items-center gap-1.5 font-semibold text-evergreen"
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        class="size-4 fill-none stroke-current stroke-[2.5]"
      >
        <path d="M3.5 8.5l3 3 6-7" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      {{ confirmation }}
    </p>
  </div>
</template>
