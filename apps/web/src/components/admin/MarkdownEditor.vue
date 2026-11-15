<script setup lang="ts">
import { computed, nextTick, useId, useTemplateRef } from 'vue'

// The lesson body's Markdown (CMS-04): a large box with buttons that add the usual pieces at
// the cursor (a part heading, bold, a list, a tip, a link), and a short guide to the headings
// the lesson page draws its own way (lib/markdown.ts). The buttons type through the browser's
// insertText, so Ctrl+Z still undoes them.

const props = defineProps<{ label: string; error?: string | null; maxlength: number }>()
const model = defineModel<string>({ required: true })

const id = useId()
const ids = { input: `${id}-input`, help: `${id}-help`, error: `${id}-error` }
const describedBy = computed(() => [ids.help, props.error && ids.error].filter(Boolean).join(' '))
const box = useTemplateRef<HTMLTextAreaElement>('box')

/** Replaces the selection with `text`, through the browser so it can be undone. */
function insert(el: HTMLTextAreaElement, text: string) {
  el.focus()
  if (!document.execCommand('insertText', false, text)) {
    // No insertText (an old browser): set the text directly. Undo won't cover it.
    const { selectionStart: start, selectionEnd: end, value } = el
    model.value = value.slice(0, start) + text + value.slice(end)
  }
}

/** Puts `before` and `after` around the selection, or around `placeholder` if none, and selects it. */
async function wrap(before: string, after: string, placeholder: string) {
  const el = box.value
  if (!el) return
  const { selectionStart: start, selectionEnd: end, value } = el
  const selected = value.slice(start, end) || placeholder
  insert(el, before + selected + after)
  await nextTick()
  el.setSelectionRange(start + before.length, start + before.length + selected.length)
}

/** Starts a block (`## `, `- `, `> **Tip:** `) on a line of its own, after a blank line. */
function block(prefix: string, placeholder: string) {
  const el = box.value
  if (!el) return
  const textBefore = el.value.slice(0, el.selectionStart)
  const gap =
    textBefore === '' || textBefore.endsWith('\n\n')
      ? ''
      : textBefore.endsWith('\n')
        ? '\n'
        : '\n\n'
  return wrap(gap + prefix, '', placeholder)
}

const TOOLS = [
  { label: 'Part heading', run: () => block('## ', 'Title of the part') },
  { label: 'Bold', run: () => wrap('**', '**', 'important words') },
  { label: 'List', run: () => block('- ', 'One point') },
  { label: 'Tip', run: () => block('> **Tip:** ', 'Something that helps') },
  { label: 'Link', run: () => wrap('[', '](https://)', 'link text') },
]

const GUIDE = [
  { md: '## What you’ll learn', then: 'and a list: the goals, in a card beside the title.' },
  { md: '## 1. Pick the right keywords', then: 'a numbered part of the lesson.' },
  { md: '## Try it', then: 'and a numbered list: the tasks, in a green panel.' },
  { md: '## Key points', then: 'and a list: the summary that closes the lesson.' },
  {
    md: '> **Tip:** …',
    then: 'a tip box. **Note:**, **Important:** and **Remember:** work too; a quote with no label is shown as an example.',
  },
]
</script>

<template>
  <div :data-invalid="error ? '' : undefined">
    <label :for="ids.input" class="text-lg font-semibold">{{ label }}</label>
    <details :id="ids.help" class="group mt-1 text-quiet">
      <summary
        class="inline-flex min-h-11 cursor-pointer items-center gap-1.5 font-semibold text-evergreen hover:underline"
      >
        How to lay out a lesson
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          class="size-4 fill-none stroke-current stroke-2 transition-transform group-open:rotate-180"
        >
          <path d="m4 6 4 4 4-4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </summary>
      <p class="mt-1">
        The text is Markdown. These headings get their own look on the lesson page:
      </p>
      <ul class="mt-2 space-y-1.5">
        <li v-for="line in GUIDE" :key="line.md">
          <code class="rounded bg-mist-soft px-1.5 py-0.5 font-mono text-sm text-ink">{{
            line.md
          }}</code>
          {{ line.then }}
        </li>
      </ul>
    </details>

    <div
      class="mt-2 overflow-hidden rounded-control border bg-surface transition-colors focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-evergreen hover:border-evergreen"
      :class="error ? 'border-error' : 'border-line-strong'"
    >
      <div
        role="toolbar"
        :aria-label="`Add to the ${label.toLowerCase()}`"
        :aria-controls="ids.input"
        class="flex flex-wrap gap-1 border-b border-line bg-mist-soft p-1"
      >
        <button
          v-for="tool in TOOLS"
          :key="tool.label"
          type="button"
          class="min-h-11 rounded-control px-3 text-sm font-semibold text-quiet transition-colors hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-evergreen"
          @click="tool.run"
        >
          {{ tool.label }}
        </button>
      </div>
      <textarea
        :id="ids.input"
        ref="box"
        v-model="model"
        rows="24"
        spellcheck="true"
        :maxlength="maxlength"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        class="block min-h-80 w-full resize-y bg-surface px-4 py-3 font-mono text-base leading-relaxed focus:outline-none"
      />
    </div>
    <div class="mt-2 flex justify-between gap-4">
      <p v-if="error" :id="ids.error" class="font-semibold text-error">{{ error }}</p>
      <p class="ml-auto shrink-0 text-sm text-quiet tabular-nums">
        {{ model.length.toLocaleString('en-US') }} / {{ maxlength.toLocaleString('en-US') }}
      </p>
    </div>
  </div>
</template>
