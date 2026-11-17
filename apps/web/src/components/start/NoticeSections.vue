<script setup lang="ts">
import { slugFromTitle } from '@digibridge/shared'
import { computed } from 'vue'
import { NOTICE_ICONS } from './choice-icons'

// A privacy notice's sections, read top to bottom. Shared by the consent page and /privacy, so
// both show the same text. On the consent page each row has the title on the left and what it
// says on the right (stacked on phones, and again beside the start pages' side panel at `lg`).
// `stacked` is for /privacy, where the contents sit beside the notice: every section is a
// numbered heading with its text below, at every width. Text is justified in both, with hyphens.
// Each section's `id` is its title's slug
// (`#your-rights`), for the contents' links.
type Notice = { sections: readonly { title: string; body: readonly string[] }[] }
const props = defineProps<{ notice: Notice; stacked?: boolean }>()

// A section whose every paragraph starts with a short label ("From Google: …") is a list of
// sources, shown as one tile per label instead of paragraphs.
const LABELLED = /^([^:]{1,30}): (.+)$/
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const sections = computed(() =>
  props.notice.sections.map((section) => {
    const matches = section.body.map((paragraph) => LABELLED.exec(paragraph))
    const items = matches.every((m) => m !== null)
      ? matches.map((m) => ({ label: m[1] ?? '', text: capitalize(m[2] ?? '') }))
      : null
    return { ...section, id: slugFromTitle(section.title), items }
  }),
)

const pad = (n: number) => String(n).padStart(2, '0')

function iconFor(title: string): readonly string[] {
  return (NOTICE_ICONS as Record<string, readonly string[]>)[title] ?? []
}
</script>

<template>
  <ol
    v-if="stacked"
    class="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface"
  >
    <li
      v-for="(section, i) in sections"
      :id="section.id"
      :key="section.title"
      class="scroll-mt-6 px-5 py-7 sm:px-8 sm:py-9"
    >
      <div class="flex items-center gap-4">
        <span
          aria-hidden="true"
          class="grid size-11 shrink-0 place-items-center rounded-control bg-evergreen-soft text-evergreen"
        >
          <svg
            viewBox="0 0 24 24"
            class="size-6 fill-none stroke-current stroke-[1.75]"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path v-for="d in iconFor(section.title)" :key="d" :d="d" />
          </svg>
        </span>
        <div>
          <p
            aria-hidden="true"
            class="font-display text-sm font-bold text-marigold-text tabular-nums"
          >
            {{ pad(i + 1) }}
          </p>
          <h3 class="text-xl leading-snug font-bold">
            <span class="sr-only">{{ i + 1 }}.</span> {{ section.title }}
          </h3>
        </div>
      </div>

      <!-- Indented to line up with the title, past the icon (size-11 + gap-4 = 3.75rem). -->
      <!-- Text here is justified and fills the card's width, so every block shares one right
           edge; hyphens (the page is lang="en") keep the gaps between words even. -->
      <!-- A labelled list ("From Google: …", "To know: …") reads like a ledger: the label in
           its own column with a marigold tick, the text beside it, dashed rules between rows. -->
      <dl v-if="section.items" class="mt-3 sm:pl-15">
        <div
          v-for="item in section.items"
          :key="item.label"
          class="grid gap-x-6 gap-y-1 border-t border-dashed border-line py-4 first:border-t-0 sm:grid-cols-[11rem_minmax(0,1fr)]"
        >
          <dt class="flex gap-2.5 font-display leading-snug font-bold text-evergreen sm:pt-0.5">
            <span aria-hidden="true" class="mt-[0.6em] h-0.5 w-3 shrink-0 bg-marigold" />
            {{ item.label }}
          </dt>
          <dd class="leading-relaxed text-justify hyphens-auto">{{ item.text }}</dd>
        </div>
      </dl>
      <div v-else class="mt-4 space-y-3 sm:pl-15">
        <p
          v-for="paragraph in section.body"
          :key="paragraph"
          class="leading-relaxed text-justify hyphens-auto"
        >
          {{ paragraph }}
        </p>
      </div>
    </li>
  </ol>

  <ol
    v-else
    class="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface"
  >
    <li
      v-for="(section, i) in sections"
      :id="section.id"
      :key="section.title"
      class="gap-8 px-5 py-6 sm:px-7 md:grid md:grid-cols-[14rem_minmax(0,1fr)] lg:grid-cols-1 xl:grid-cols-[16rem_minmax(0,1fr)] xl:py-7 2xl:grid-cols-[18rem_minmax(0,1fr)]"
    >
      <div class="flex items-center gap-3 md:items-start lg:items-center xl:items-start">
        <span
          aria-hidden="true"
          class="grid size-10 shrink-0 place-items-center rounded-control bg-evergreen-soft text-evergreen"
        >
          <svg
            viewBox="0 0 24 24"
            class="size-6 fill-none stroke-current stroke-[1.75]"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path v-for="d in iconFor(section.title)" :key="d" :d="d" />
          </svg>
        </span>
        <h3 class="text-lg leading-snug font-bold md:pt-2 lg:pt-0 xl:pt-2">
          <span class="sr-only">{{ i + 1 }}.</span> {{ section.title }}
        </h3>
      </div>

      <!-- "From Google: …"-style lists become one labelled tile per item. -->
      <ul v-if="section.items" class="mt-4 grid gap-3 md:mt-0 lg:mt-4 xl:mt-0 2xl:grid-cols-3">
        <li
          v-for="item in section.items"
          :key="item.label"
          class="rounded-control bg-mist-soft px-4 py-3.5"
        >
          <p class="font-semibold text-evergreen">{{ item.label }}</p>
          <p class="mt-1 leading-relaxed text-justify hyphens-auto">{{ item.text }}</p>
        </li>
      </ul>
      <div v-else class="mt-3 space-y-3 md:mt-0 md:pt-2 lg:mt-3 lg:pt-0 xl:mt-0 xl:pt-2">
        <p
          v-for="paragraph in section.body"
          :key="paragraph"
          class="max-w-[68ch] leading-relaxed text-justify hyphens-auto"
        >
          {{ paragraph }}
        </p>
      </div>
    </li>
  </ol>
</template>
