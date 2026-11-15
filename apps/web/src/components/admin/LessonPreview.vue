<script setup lang="ts">
import { AREA_LABELS, LESSON_TIER_LABELS, type AreaCode, type LessonTier } from '@digibridge/shared'
import { computed } from 'vue'
import { renderLesson } from '../../lib/markdown'
import LessonBody from '../lessons/LessonBody.vue'
import LessonVideo from '../lessons/LessonVideo.vue'
import LevelDots from '../lessons/LevelDots.vue'
import TierMeter from '../lessons/TierMeter.vue'
import { areaNumber } from './lesson-text'

// The lessons editor's preview (CMS-04): the lesson drawn with the lesson page's own parts
// (renderLesson and LessonBody), so callouts, Try it and Key points look as they will for
// students. Students only see the light theme, so the preview keeps it (`.light-theme`) in a
// dark admin area too. Sized for half the screen: the page's large title and side contents are
// left out. A link that isn't valid yet shows nothing in its place.

const props = defineProps<{
  area: AreaCode
  tier: LessonTier
  title: string
  summary: string
  bodyMd: string
  imageUrl: string
  videoUrl: string
  resources: { label: string; url: string }[]
}>()

const rendered = computed(() => renderLesson(props.bodyMd))
const goals = computed(() => rendered.value.sections.find((s) => s.kind === 'goals') ?? null)
const sections = computed(() => rendered.value.sections.filter((s) => s.kind !== 'goals'))

const isHttpLink = (url: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(url.trim()).protocol)
  } catch {
    return false
  }
}
const resources = computed(() => props.resources.filter((r) => r.label.trim() && isHttpLink(r.url)))
</script>

<template>
  <div class="light-theme bg-mist">
    <header class="border-b border-line px-5 pt-6 pb-8 sm:px-8">
      <p class="flex flex-wrap items-center gap-2 text-sm font-semibold text-quiet">
        <span class="font-display text-marigold-text tabular-nums">{{ areaNumber(area) }}</span>
        {{ AREA_LABELS[area] }}
      </p>
      <p class="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
        <span class="inline-flex items-center gap-2.5 font-semibold text-evergreen">
          <TierMeter :tier="tier" />
          {{ LESSON_TIER_LABELS[tier] }} lesson
        </span>
        <LevelDots :tier="tier" ring="ring-mist" class="text-sm text-quiet" />
      </p>
      <h2
        class="mt-4 text-4xl leading-[1.05] font-extrabold tracking-[-0.025em] text-balance"
        :class="!title.trim() && 'text-quiet/60'"
      >
        {{ title.trim() || 'Your lesson’s title' }}
      </h2>
      <p class="mt-4 text-lg leading-relaxed text-quiet" :class="!summary.trim() && 'italic'">
        {{ summary.trim() || 'The summary shows here and on the lesson’s card.' }}
      </p>
      <p class="mt-4 text-sm font-semibold text-quiet">About {{ rendered.minutes }} min to read</p>

      <aside
        v-if="goals"
        class="mt-8 rounded-card border border-line bg-surface p-6 shadow-[0_24px_48px_-32px_rgb(18_36_28/0.45)]"
      >
        <h3 class="text-lg font-bold">{{ goals.title }}</h3>
        <ul class="mt-4 space-y-3.5">
          <li v-for="(goal, i) in goals.items" :key="i" class="flex gap-3 leading-snug">
            <span
              aria-hidden="true"
              class="mt-px grid size-6 shrink-0 place-items-center rounded-full bg-evergreen-soft text-evergreen"
            >
              <svg viewBox="0 0 16 16" class="size-3.5 fill-none stroke-current stroke-[2.5]">
                <path d="m3.5 8.5 3 3 6-7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
            <!-- Cleaned by DOMPurify in lib/markdown.ts. -->
            <!-- eslint-disable-next-line vue/no-v-html -->
            <span class="min-w-0" v-html="goal" />
          </li>
        </ul>
      </aside>
    </header>

    <div class="bg-surface px-5 py-10 sm:px-8">
      <img
        v-if="isHttpLink(imageUrl)"
        :src="imageUrl.trim()"
        :alt="title"
        class="mb-10 w-full rounded-card border border-line object-cover"
      />
      <LessonVideo
        v-if="isHttpLink(videoUrl)"
        :url="videoUrl.trim()"
        :title="title"
        class="mb-10"
      />
      <LessonBody v-if="sections.length" :sections="sections" />
      <p v-else class="rounded-card border border-dashed border-line-strong/50 p-6 text-quiet">
        The lesson’s text shows here as you write it.
      </p>
    </div>

    <section v-if="resources.length" class="px-5 py-10 sm:px-8">
      <h3 class="text-xl font-bold">Learn more</h3>
      <ul class="mt-4 divide-y divide-line border-y border-line">
        <li v-for="(resource, i) in resources" :key="i" class="py-4">
          <a
            :href="resource.url.trim()"
            target="_blank"
            rel="noopener noreferrer"
            class="leading-snug font-semibold text-evergreen underline-offset-2 hover:underline"
          >
            {{ resource.label }}
          </a>
        </li>
      </ul>
    </section>
  </div>
</template>
