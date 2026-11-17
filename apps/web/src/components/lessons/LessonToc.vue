<script setup lang="ts">
import { useRoute } from 'vue-router'
import type { LessonSection } from '../../lib/markdown'

// The lesson's contents beside it on desktops: one link per part, with the part on screen
// marked (`activeId`, from useReadingPosition) and the ones above it ticked off on the line.
// The privacy page uses it for the notice's sections, with its own `title`.
const props = withDefaults(
  defineProps<{
    sections: Pick<LessonSection, 'id' | 'title' | 'number'>[]
    activeId: string | null
    title?: string
  }>(),
  { title: 'In this lesson' },
)

// Hash links keep the query, so /privacy?notice=school stays on the school notice.
const route = useRoute()

const pad = (n: number) => String(n).padStart(2, '0')
const activeIndex = () => props.sections.findIndex((s) => s.id === props.activeId)
</script>

<template>
  <nav aria-labelledby="toc-title">
    <p id="toc-title" class="text-sm font-semibold text-quiet">{{ title }}</p>
    <ol class="mt-4">
      <li v-for="(section, i) in sections" :key="section.id" class="relative">
        <RouterLink
          :to="{ query: route.query, hash: `#${section.id}` }"
          :aria-current="section.id === activeId ? 'location' : undefined"
          class="group flex gap-3 border-l-2 py-2 pr-2 pl-4 leading-snug transition-colors"
          :class="
            section.id === activeId
              ? 'border-evergreen font-semibold text-ink'
              : i < activeIndex()
                ? 'border-evergreen/40 text-quiet hover:text-ink'
                : 'border-line text-quiet hover:border-line-strong hover:text-ink'
          "
        >
          <span
            aria-hidden="true"
            class="w-5 shrink-0 font-display text-sm font-bold tabular-nums"
            :class="section.id === activeId ? 'text-marigold-text' : 'text-quiet/70'"
          >
            <template v-if="section.number !== null">{{ pad(section.number) }}</template>
            <span v-else class="mt-2 block size-1.5 rounded-full bg-current" />
          </span>
          {{ section.title }}
        </RouterLink>
      </li>
    </ol>
  </nav>
</template>
