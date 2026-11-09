<script setup lang="ts">
import type { LessonSection } from '../../lib/markdown'

// A lesson's parts, as lib/markdown.ts splits them (the goals are shown beside the title, so
// they aren't passed here). Numbered parts get an eyebrow and a large heading, "Try it" is a
// green panel of numbered tasks, and "Key points" a closing panel of checks. Every `html` and
// item is already cleaned by DOMPurify. Each part's `id` is its link target in the contents.
defineProps<{ sections: LessonSection[] }>()

const pad = (n: number) => String(n).padStart(2, '0')
</script>

<template>
  <div>
    <template v-for="section in sections" :key="section.id">
      <!-- Text before the first heading. -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-if="section.kind === 'intro'" class="lesson-prose mb-14" v-html="section.html" />

      <section
        v-else-if="section.kind === 'activity'"
        :id="section.id"
        :aria-labelledby="`${section.id}-title`"
        class="relative isolate mt-16 scroll-mt-8 overflow-hidden rounded-card bg-evergreen px-5 py-8 text-white sm:px-9 sm:py-10"
      >
        <!-- A faint target in the corner: something to aim at. Decoration only. -->
        <svg
          viewBox="0 0 120 120"
          aria-hidden="true"
          class="absolute -top-10 -right-10 -z-10 size-48 fill-none stroke-white/10 stroke-[10]"
        >
          <circle cx="60" cy="60" r="55" />
          <circle cx="60" cy="60" r="32" />
          <circle cx="60" cy="60" r="10" class="fill-white/10 stroke-none" />
        </svg>
        <p class="flex items-center gap-3 font-semibold text-marigold">
          <span class="h-px w-8 bg-current" aria-hidden="true" />
          Your turn
        </p>
        <h2
          :id="`${section.id}-title`"
          class="mt-3 text-3xl leading-tight font-bold tracking-[-0.02em]"
        >
          {{ section.title }}
        </h2>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-if="section.html" class="lesson-prose on-green mt-4" v-html="section.html" />
        <ol
          v-if="section.items.length"
          class="mt-6 divide-y divide-white/15 border-y border-white/15"
        >
          <li v-for="(item, i) in section.items" :key="i" class="flex gap-4 py-5">
            <span
              aria-hidden="true"
              class="grid size-9 shrink-0 place-items-center rounded-full bg-marigold font-display font-bold text-ink"
            >
              {{ i + 1 }}
            </span>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div class="lesson-prose on-green min-w-0 pt-1" v-html="item" />
          </li>
        </ol>
      </section>

      <section
        v-else-if="section.kind === 'summary'"
        :id="section.id"
        :aria-labelledby="`${section.id}-title`"
        class="mt-8 scroll-mt-8 rounded-card border border-line bg-mist-soft px-5 py-8 sm:px-9 sm:py-10"
      >
        <p class="flex items-center gap-3 font-semibold text-evergreen">
          <span class="h-px w-8 bg-current" aria-hidden="true" />
          Before you go
        </p>
        <h2
          :id="`${section.id}-title`"
          class="mt-3 text-3xl leading-tight font-bold tracking-[-0.02em]"
        >
          {{ section.title }}
        </h2>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-if="section.html" class="lesson-prose mt-4" v-html="section.html" />
        <ul v-if="section.items.length" class="mt-6 grid gap-x-8 gap-y-5 md:grid-cols-2">
          <li v-for="(item, i) in section.items" :key="i" class="flex gap-3">
            <span
              aria-hidden="true"
              class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-evergreen text-white"
            >
              <svg viewBox="0 0 16 16" class="size-3.5 fill-none stroke-current stroke-[2.5]">
                <path d="m3.5 8.5 3 3 6-7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div class="lesson-prose min-w-0" v-html="item" />
          </li>
        </ul>
      </section>

      <section
        v-else
        :id="section.id"
        :aria-labelledby="`${section.id}-title`"
        class="scroll-mt-8 border-t border-line pt-12 not-first:mt-14 first:border-t-0 first:pt-0"
      >
        <p
          v-if="section.number !== null"
          aria-hidden="true"
          class="flex items-center gap-3 font-semibold text-marigold-text"
        >
          <span class="h-px w-8 bg-current" />
          Part {{ pad(section.number) }}
        </p>
        <h2
          :id="`${section.id}-title`"
          class="text-[clamp(1.75rem,1.45rem+1vw,2.25rem)] leading-[1.1] font-bold tracking-[-0.02em] text-balance"
          :class="section.number !== null && 'mt-3'"
        >
          <span v-if="section.number !== null" class="sr-only">Part {{ section.number }}: </span>
          {{ section.title }}
        </h2>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="lesson-prose mt-6" v-html="section.html" />
      </section>
    </template>
  </div>
</template>
