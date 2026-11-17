<script setup lang="ts">
import { computed } from 'vue'
import { NOTICE_ICONS } from './choice-icons'

// A privacy notice's sections, one row each, read top to bottom: the title on the left, what it
// says on the right (stacked on phones). Shared by the consent page and /privacy, so both show
// the same text. `wide` is for a page without the start pages' side panel: its rows go side by
// side from `md` on, where the consent page stacks them again beside the panel at `lg`.
type Notice = { sections: readonly { title: string; body: readonly string[] }[] }
const props = defineProps<{ notice: Notice; wide?: boolean }>()

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
    return { ...section, items }
  }),
)

function iconFor(title: string): readonly string[] {
  return (NOTICE_ICONS as Record<string, readonly string[]>)[title] ?? []
}
</script>

<template>
  <ol class="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
    <li
      v-for="(section, i) in sections"
      :key="section.title"
      class="gap-8 px-5 py-6 sm:px-7 md:grid md:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)] xl:py-7 2xl:grid-cols-[18rem_minmax(0,1fr)]"
      :class="{ 'lg:grid-cols-1': !wide }"
    >
      <div
        class="flex items-center gap-3 md:items-start xl:items-start"
        :class="{ 'lg:items-center': !wide }"
      >
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
        <h3 class="text-lg leading-snug font-bold md:pt-2 xl:pt-2" :class="{ 'lg:pt-0': !wide }">
          <span class="sr-only">{{ i + 1 }}.</span> {{ section.title }}
        </h3>
      </div>

      <!-- "From Google: …"-style lists become one labelled tile per item. -->
      <ul
        v-if="section.items"
        class="mt-4 grid gap-3 md:mt-0 xl:mt-0 2xl:grid-cols-3"
        :class="{ 'lg:mt-4': !wide }"
      >
        <li
          v-for="item in section.items"
          :key="item.label"
          class="rounded-control bg-mist-soft px-4 py-3.5"
        >
          <p class="font-semibold text-evergreen">{{ item.label }}</p>
          <p class="mt-1 leading-relaxed">{{ item.text }}</p>
        </li>
      </ul>
      <div
        v-else
        class="mt-3 space-y-3 md:mt-0 md:pt-2 xl:mt-0 xl:pt-2"
        :class="{ 'lg:mt-3 lg:pt-0': !wide }"
      >
        <p v-for="paragraph in section.body" :key="paragraph" class="max-w-[68ch] leading-relaxed">
          {{ paragraph }}
        </p>
      </div>
    </li>
  </ol>
</template>
