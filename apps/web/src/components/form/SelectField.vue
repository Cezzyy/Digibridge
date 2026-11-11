<script setup lang="ts" generic="T extends string | number | null">
import { computed, nextTick, onBeforeUnmount, ref, useId, useTemplateRef } from 'vue'

// A labelled dropdown that looks like TextField, in place of a native <select>. It follows
// the ARIA select-only combobox pattern: focus stays on the box while the list is open, and
// `aria-activedescendant` points at the option under the cursor. Keyboard: Down, Up, Enter or
// Space opens; arrows, Home and End move; Enter, Space or Tab picks; Escape closes. Typing a
// few letters jumps to the first option that starts with them.

const props = defineProps<{
  label: string
  hint?: string
  error?: string | null
  options: readonly { value: T; label: string }[]
}>()
const model = defineModel<T>({ required: true })

const id = useId()
const ids = {
  label: `${id}-label`,
  list: `${id}-list`,
  hint: `${id}-hint`,
  error: `${id}-error`,
  option: (index: number) => `${id}-option-${index}`,
}
const describedBy = computed(
  () => [props.hint && ids.hint, props.error && ids.error].filter(Boolean).join(' ') || undefined,
)

const box = useTemplateRef<HTMLElement>('box')
const list = useTemplateRef<HTMLElement>('list')

const open = ref(false)
const active = ref(0)
const selectedIndex = computed(() => props.options.findIndex((o) => o.value === model.value))
const selected = computed(() => props.options[selectedIndex.value])
const last = () => props.options.length - 1

/** Scrolls the list (not the page) so the active option shows. */
function revealActive() {
  const el = list.value?.children[active.value] as HTMLElement | undefined
  if (!el || !list.value) return
  const { scrollTop, clientHeight } = list.value
  if (el.offsetTop < scrollTop) list.value.scrollTop = el.offsetTop
  else if (el.offsetTop + el.offsetHeight > scrollTop + clientHeight)
    list.value.scrollTop = el.offsetTop + el.offsetHeight - clientHeight
}

async function show(index = Math.max(selectedIndex.value, 0)) {
  active.value = index
  open.value = true
  await nextTick()
  list.value?.scrollIntoView({ block: 'nearest' })
  revealActive()
}

function pick(index: number) {
  const option = props.options[index]
  if (option) model.value = option.value
  open.value = false
}

function move(index: number) {
  active.value = Math.min(Math.max(index, 0), last())
  revealActive()
}

// Letters typed within 600 ms of each other add up ("bs" finds BSIT). A single letter typed
// again moves on to the next option with that letter.
let typed = ''
let typedTimer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(typedTimer))

function findTyped(key: string) {
  clearTimeout(typedTimer)
  typedTimer = setTimeout(() => (typed = ''), 600)
  typed += key.toLowerCase()
  const count = props.options.length
  const start = typed.length === 1 ? active.value + 1 : active.value
  for (let step = 0; step < count; step++) {
    const index = (start + step) % count
    if (props.options[index]?.label.toLowerCase().startsWith(typed)) return index
  }
  return -1
}

const isTyping = (event: KeyboardEvent) =>
  event.key.length === 1 &&
  !event.ctrlKey &&
  !event.metaKey &&
  !event.altKey &&
  (event.key !== ' ' || typed !== '')

function onKeydown(event: KeyboardEvent) {
  if (isTyping(event)) {
    const index = findTyped(event.key)
    event.preventDefault()
    if (index < 0) return
    if (open.value) move(index)
    else void show(index)
    return
  }

  if (!open.value) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) void show()
    else if (event.key === 'Home') void show(0)
    else if (event.key === 'End') void show(last())
    else return
    event.preventDefault()
    return
  }

  switch (event.key) {
    case 'ArrowDown':
      move(active.value + 1)
      break
    case 'ArrowUp':
      if (event.altKey) pick(active.value)
      else move(active.value - 1)
      break
    case 'Home':
      move(0)
      break
    case 'End':
      move(last())
      break
    case 'Enter':
    case ' ':
      pick(active.value)
      break
    case 'Escape':
      open.value = false
      break
    case 'Tab':
      pick(active.value) // and let focus move on
      return
    default:
      return
  }
  event.preventDefault()
}
</script>

<template>
  <div :data-invalid="error ? '' : undefined">
    <div :id="ids.label" class="w-fit text-lg font-semibold" @click="box?.focus()">
      {{ label }}
    </div>
    <p v-if="hint" :id="ids.hint" class="mt-0.5 text-quiet">{{ hint }}</p>
    <div class="relative mt-2">
      <div
        ref="box"
        role="combobox"
        tabindex="0"
        aria-haspopup="listbox"
        :aria-expanded="open"
        :aria-controls="ids.list"
        :aria-labelledby="ids.label"
        :aria-activedescendant="open ? ids.option(active) : undefined"
        :aria-describedby="describedBy"
        :aria-invalid="error ? 'true' : undefined"
        class="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-control border bg-surface pr-3 pl-4 text-lg transition-colors select-none hover:border-evergreen focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-evergreen"
        :class="error ? 'border-error' : open ? 'border-evergreen' : 'border-line-strong'"
        @click="open ? (open = false) : show()"
        @keydown="onKeydown"
        @blur="open = false"
      >
        <span class="truncate">{{ selected?.label }}</span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          class="size-5 shrink-0 fill-none stroke-quiet stroke-2 transition-transform motion-safe:duration-200"
          :class="open && 'rotate-180'"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>

      <Transition
        enter-active-class="motion-safe:transition motion-safe:duration-200 motion-safe:ease-glide"
        enter-from-class="opacity-0 -translate-y-1 scale-[0.98]"
        leave-active-class="motion-safe:transition motion-safe:duration-150"
        leave-to-class="opacity-0"
      >
        <!-- mousedown.prevent keeps focus on the box, so a tap on an option doesn't close it first. -->
        <ul
          v-if="open"
          :id="ids.list"
          ref="list"
          role="listbox"
          :aria-labelledby="ids.label"
          class="absolute inset-x-0 top-full z-20 mt-2 max-h-72 origin-top overflow-y-auto overscroll-contain rounded-card border border-line bg-surface p-1.5 shadow-[0_16px_40px_-16px_rgb(18_36_28/0.35)]"
          @mousedown.prevent
        >
          <li
            v-for="(option, i) in options"
            :id="ids.option(i)"
            :key="String(option.value)"
            role="option"
            :aria-selected="i === selectedIndex"
            class="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-control px-3 text-lg"
            :class="[
              i === active && 'bg-evergreen-soft',
              i === selectedIndex && 'font-semibold text-evergreen',
            ]"
            @mousemove="active = i"
            @click="pick(i)"
          >
            {{ option.label }}
            <svg
              v-if="i === selectedIndex"
              viewBox="0 0 16 16"
              aria-hidden="true"
              class="size-4 shrink-0 fill-none stroke-current stroke-[2.5]"
            >
              <path d="M3.5 8.5l3 3 6-7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </li>
        </ul>
      </Transition>
    </div>
    <p v-if="error" :id="ids.error" class="mt-2 font-semibold text-error">{{ error }}</p>
  </div>
</template>
