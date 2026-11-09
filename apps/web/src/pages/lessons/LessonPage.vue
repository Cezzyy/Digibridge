<script setup lang="ts">
import { AREA_CODES, AREA_LABELS, LESSON_TIER_LABELS, LESSON_TIERS } from '@digibridge/shared'
import { computed, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import LessonTile from '../../components/lessons/LessonTile.vue'
import LessonVideo from '../../components/lessons/LessonVideo.vue'
import SkeletonText from '../../components/results/SkeletonText.vue'
import { useLesson } from '../../composables/useLesson'
import { useLessons } from '../../composables/useLessons'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../lib/buttons'
import { renderMarkdown } from '../../lib/markdown'
import { useSessionStore } from '../../stores/session'

// One lesson (LES-02): its area and tier, title, summary, image or video, the body rendered from
// Markdown and cleaned (lib/markdown.ts), and its outside resources. Beside it, the area's other
// lessons, so a student can go on to the next tier. Open to everyone (LES-03). Loaded lazily by
// the router, so markdown-it and DOMPurify aren't in the first load.
const route = useRoute()
const session = useSessionStore()
const { lesson, notFound, error, load } = useLesson()
const { lessons: areaLessons, load: loadAreaLessons } = useLessons()

const slug = computed(() => String(route.params.slug))

// Going from one lesson to another keeps this page open, so load again when the slug changes.
async function fetchLesson() {
  await load(slug.value)
  if (lesson.value) await loadAreaLessons({ area: lesson.value.area })
}
watch(slug, fetchLesson, { immediate: true })

const html = computed(() => (lesson.value ? renderMarkdown(lesson.value.bodyMd) : ''))

const area = computed(() => {
  if (!lesson.value) return null
  const code = lesson.value.area
  return {
    number: String(AREA_CODES.indexOf(code) + 1).padStart(2, '0'),
    label: AREA_LABELS[code],
  }
})

// The area's 3 tiers, with this lesson marked. Empty until the area's list comes in.
const tiers = computed(() => {
  const list = areaLessons.value
  if (!list || !lesson.value) return []
  return LESSON_TIERS.map((tier) => ({
    tier,
    lesson: list.find((l) => l.tier === tier) ?? null,
    current: tier === lesson.value?.tier,
  }))
})

const updatedOn = computed(() =>
  lesson.value
    ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' }).format(
        new Date(lesson.value.updatedAt),
      )
    : '',
)

// The tab shows the lesson's title while it's open, and the app's own title again after.
const appTitle = document.title
watch(lesson, (open) => {
  document.title = open ? `${open.title} · DigiBridge` : appTitle
})
onUnmounted(() => {
  document.title = appTitle
})
</script>

<template>
  <main class="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10 lg:px-10">
    <nav aria-label="Lessons" class="flex flex-wrap gap-x-6 gap-y-2">
      <RouterLink
        :to="{ name: 'lessons' }"
        class="inline-flex min-h-11 items-center gap-1.5 font-semibold text-evergreen hover:underline"
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          class="size-4 fill-none stroke-current stroke-[2.5]"
        >
          <path d="M10 3.5 5.5 8 10 12.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        All lessons
      </RouterLink>
      <RouterLink
        v-if="session.attemptFinished"
        :to="{ name: 'results' }"
        class="inline-flex min-h-11 items-center font-semibold text-evergreen hover:underline"
      >
        Your results
      </RouterLink>
    </nav>

    <!-- No such lesson, or not published yet. -->
    <div
      v-if="notFound"
      class="mt-6 flex max-w-xl flex-col items-start gap-4 rounded-card border border-line bg-surface p-6"
    >
      <div>
        <h1 class="text-2xl font-bold">We couldn’t find this lesson</h1>
        <p class="mt-1 leading-relaxed text-quiet">
          The link may be wrong, or the lesson isn’t out yet. You can pick another one from the
          library.
        </p>
      </div>
      <RouterLink :to="{ name: 'lessons' }" :class="PRIMARY_BUTTON">See all lessons</RouterLink>
    </div>

    <!-- Couldn't load: say so in place, with a way to try again. -->
    <div
      v-else-if="error"
      role="alert"
      class="mt-6 flex max-w-xl flex-col items-start gap-4 rounded-card border border-error/30 bg-error-soft p-6"
    >
      <div>
        <h1 class="text-xl font-bold">We couldn’t load this lesson</h1>
        <p class="mt-1 leading-relaxed">{{ error }}</p>
      </div>
      <div class="flex flex-wrap gap-3">
        <button type="button" :class="PRIMARY_BUTTON" @click="fetchLesson">Try again</button>
        <RouterLink :to="{ name: 'lessons' }" :class="SECONDARY_BUTTON">See all lessons</RouterLink>
      </div>
    </div>

    <div
      v-else
      class="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_22rem]"
      :aria-busy="!lesson"
    >
      <p class="sr-only" role="status">{{ lesson ? '' : 'Loading the lesson' }}</p>

      <article v-if="lesson && area" class="min-w-0 motion-safe:animate-rise">
        <header>
          <p class="flex flex-wrap items-center gap-x-3 gap-y-2 font-semibold">
            <span class="flex gap-2 text-quiet">
              <span class="font-display text-marigold-text tabular-nums">{{ area.number }}</span>
              {{ area.label }}
            </span>
            <span class="rounded-full bg-evergreen-soft px-2.5 py-0.5 text-sm text-evergreen">
              {{ LESSON_TIER_LABELS[lesson.tier] }}
            </span>
          </p>
          <h1
            class="mt-3 text-[clamp(2rem,1.5rem+1.6vw,3rem)] leading-[1.05] font-extrabold tracking-[-0.02em] text-balance"
          >
            {{ lesson.title }}
          </h1>
          <p class="mt-4 max-w-[60ch] text-xl leading-relaxed text-quiet">{{ lesson.summary }}</p>
        </header>

        <img
          v-if="lesson.imageUrl"
          :src="lesson.imageUrl"
          :alt="lesson.title"
          class="mt-8 w-full rounded-card border border-line object-cover"
        />
        <LessonVideo
          v-if="lesson.videoUrl"
          :url="lesson.videoUrl"
          :title="lesson.title"
          class="mt-8"
        />

        <!-- Markdown rendered by markdown-it and cleaned by DOMPurify (lib/markdown.ts). -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="lesson-prose mt-8 max-w-[68ch]" v-html="html" />

        <p class="mt-10 border-t border-line pt-4 text-sm text-quiet">Updated {{ updatedOn }}</p>
      </article>

      <!-- Shaped like the lesson's header and first lines while it loads. -->
      <div v-else aria-hidden="true" class="min-w-0">
        <p class="flex items-center gap-3 font-semibold">
          <SkeletonText class="w-[14em]" />
          <span class="h-6 w-24 rounded-full bg-mist motion-safe:animate-skeleton" />
        </p>
        <p class="mt-3 text-[clamp(2rem,1.5rem+1.6vw,3rem)] leading-[1.05] font-extrabold">
          <SkeletonText class="w-4/5" />
        </p>
        <p class="mt-4 max-w-[60ch] text-xl leading-relaxed">
          <SkeletonText class="w-full" />
          <br />
          <SkeletonText class="w-1/2" />
        </p>
        <div class="mt-8 max-w-[68ch] space-y-3 text-lg leading-relaxed">
          <p><SkeletonText class="w-[10em]" /></p>
          <p v-for="n in 4" :key="n"><SkeletonText class="w-full" /></p>
          <p><SkeletonText class="w-3/4" /></p>
        </div>
      </div>

      <aside
        v-if="lesson"
        class="space-y-8 lg:sticky lg:top-[calc(var(--spacing-header)+2rem)] lg:self-start"
      >
        <section v-if="lesson.resources.length" aria-labelledby="resources-title">
          <h2 id="resources-title" class="text-xl font-bold">Learn more</h2>
          <ul class="mt-3 space-y-2">
            <li v-for="resource in lesson.resources" :key="resource.url">
              <a
                :href="resource.url"
                target="_blank"
                rel="noopener noreferrer"
                class="group flex min-h-11 items-start gap-2.5 rounded-control px-3 py-2.5 font-semibold text-evergreen hover:bg-evergreen-soft"
              >
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  class="mt-1 size-4 shrink-0 fill-none stroke-current stroke-2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M9 3h4v4M13 3 7 9M11 9.5V13H3V5h3.5" />
                </svg>
                <span>
                  {{ resource.label }}
                  <span class="sr-only">(opens in a new tab)</span>
                </span>
              </a>
            </li>
          </ul>
        </section>

        <section v-if="tiers.length" aria-labelledby="area-lessons-title">
          <h2 id="area-lessons-title" class="text-xl font-bold">In this area</h2>
          <ul class="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <li v-for="item in tiers" :key="item.tier">
              <LessonTile :tier="item.tier" :lesson="item.lesson" :current="item.current" />
            </li>
          </ul>
        </section>
      </aside>
    </div>
  </main>
</template>
