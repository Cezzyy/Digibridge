<script setup lang="ts">
import { AREA_CODES, AREA_LABELS, LESSON_TIER_LABELS, LESSON_TIERS } from '@digibridge/shared'
import { computed, nextTick, onUnmounted, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import LessonBody from '../../components/lessons/LessonBody.vue'
import LessonBodySkeleton from '../../components/lessons/LessonBodySkeleton.vue'
import LessonTile from '../../components/lessons/LessonTile.vue'
import LessonTileSkeleton from '../../components/lessons/LessonTileSkeleton.vue'
import LessonToc from '../../components/lessons/LessonToc.vue'
import LessonVideo from '../../components/lessons/LessonVideo.vue'
import LevelDots from '../../components/lessons/LevelDots.vue'
import TierMeter from '../../components/lessons/TierMeter.vue'
import SkeletonText from '../../components/results/SkeletonText.vue'
import { useLesson } from '../../composables/useLesson'
import { useLessons } from '../../composables/useLessons'
import { useReadingPosition } from '../../composables/useReadingPosition'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../lib/buttons'
import { renderLesson } from '../../lib/markdown'
import { useSessionStore } from '../../stores/session'

// One lesson (LES-02). The header has its area and tier, title, summary, reading time and what
// it teaches; under it, the lesson's parts (LessonBody) with their contents beside them on
// desktops, and a bar at the top that fills as the student reads. It ends with the next tier's
// lesson, the outside resources and the area's 3 lessons. Open to everyone (LES-03). Loaded
// lazily by the router, so markdown-it and DOMPurify aren't in the first load.
const route = useRoute()
const session = useSessionStore()
const { lesson, notFound, error, load } = useLesson()
const { lessons: areaLessons, error: areaError, load: loadAreaLessons } = useLessons()

const slug = computed(() => String(route.params.slug))

// Going from one lesson to another keeps this page open, so load again when the slug changes.
async function fetchLesson() {
  await load(slug.value)
  if (lesson.value) await loadAreaLessons({ area: lesson.value.area })
}
watch(slug, fetchLesson, { immediate: true })

// While the lesson loads, the page is drawn with placeholders the shape of each part. Once it's
// in, the area's list still has to come: What's next and the area's tiles wait for it. If that
// list fails, those parts are just left out.
const loading = computed(() => !lesson.value && !notFound.value && !error.value)
const areaLoading = computed(() => !!lesson.value && !areaLessons.value && !areaError.value)

const rendered = computed(() => (lesson.value ? renderLesson(lesson.value.bodyMd) : null))
const goals = computed(() => rendered.value?.sections.find((s) => s.kind === 'goals') ?? null)
const sections = computed(() => rendered.value?.sections.filter((s) => s.kind !== 'goals') ?? [])
const contents = computed(() => sections.value.filter((s) => s.kind !== 'intro'))
const partCount = computed(() => sections.value.filter((s) => s.kind === 'part').length)

const article = useTemplateRef<HTMLElement>('article')
const { progress, activeId, refresh } = useReadingPosition(
  article,
  computed(() => contents.value.map((s) => s.id)),
)
watch(rendered, () => nextTick(refresh))

const area = computed(() => {
  if (!lesson.value) return null
  const code = lesson.value.area
  return {
    code,
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

// The tier after this one, or null on the last tier (or before the list comes in).
const next = computed(() => {
  const i = tiers.value.findIndex((t) => t.current)
  return i < 0 ? null : (tiers.value[i + 1] ?? null)
})
const isLastTier = computed(() => tiers.value.length > 0 && next.value === null)

const resources = computed(() =>
  (lesson.value?.resources ?? []).map((resource) => {
    let site = ''
    try {
      site = new URL(resource.url).hostname.replace(/^www\./, '')
    } catch {
      // The API checks every URL, so this shouldn't happen; the label is enough on its own.
    }
    return { ...resource, site }
  }),
)

const updatedOn = computed(() =>
  lesson.value
    ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }).format(
        new Date(lesson.value.updatedAt),
      )
    : '',
)

const facts = computed(() =>
  rendered.value
    ? [
        { value: `${rendered.value.minutes} min`, label: 'to read' },
        ...(partCount.value ? [{ value: String(partCount.value), label: 'parts' }] : []),
        { value: updatedOn.value, label: 'last updated' },
      ]
    : [],
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
  <div>
    <!-- How far through the lesson the student is. The text itself says where they are. -->
    <div aria-hidden="true" class="sticky top-header z-20 -mb-1 h-1">
      <div
        class="h-full origin-left bg-evergreen transition-transform duration-150 ease-out"
        :style="{ transform: `scaleX(${lesson ? progress : 0})` }"
      />
    </div>

    <header class="border-b border-line">
      <div class="mx-auto max-w-7xl px-4 pt-4 pb-12 sm:px-8 sm:pb-16 lg:px-10 lg:pb-20">
        <nav
          aria-label="Breadcrumb"
          class="flex flex-wrap items-center justify-between gap-x-6 text-sm font-semibold"
        >
          <ol class="flex min-w-0 flex-wrap items-center gap-x-2">
            <li>
              <RouterLink
                :to="{ name: 'lessons' }"
                class="inline-flex min-h-11 items-center text-evergreen hover:underline"
              >
                Lessons
              </RouterLink>
            </li>
            <li v-if="area" class="flex min-w-0 items-center gap-2">
              <span aria-hidden="true" class="text-line-strong">/</span>
              <RouterLink
                :to="{ name: 'lessons', hash: `#area-${area.code}` }"
                class="inline-flex min-h-11 items-center gap-2 text-quiet hover:text-ink hover:underline"
              >
                <span class="font-display text-marigold-text tabular-nums">{{ area.number }}</span>
                {{ area.label }}
              </RouterLink>
            </li>
            <li v-else-if="loading" aria-hidden="true" class="flex min-h-11 items-center gap-2">
              <span class="text-line-strong">/</span>
              <SkeletonText tone="page" class="w-[13em]" />
            </li>
          </ol>
          <RouterLink
            v-if="session.attemptFinished"
            :to="{ name: 'results' }"
            class="inline-flex min-h-11 items-center gap-1.5 text-evergreen hover:underline"
          >
            Your results
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              class="size-4 fill-none stroke-current stroke-[2.5]"
            >
              <path d="M6 3.5 10.5 8 6 12.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </RouterLink>
        </nav>

        <!-- No such lesson, or not published yet. -->
        <div v-if="notFound" class="mt-10 max-w-xl">
          <h1 class="text-4xl leading-tight font-bold tracking-[-0.02em]">
            We couldn’t find this lesson
          </h1>
          <p class="mt-3 text-lg leading-relaxed text-quiet">
            The link may be wrong, or the lesson isn’t out yet. You can pick another one from the
            library.
          </p>
          <RouterLink :to="{ name: 'lessons' }" :class="PRIMARY_BUTTON" class="mt-6">
            See all lessons
          </RouterLink>
        </div>

        <!-- Couldn't load: say so in place, with a way to try again. -->
        <div
          v-else-if="error"
          role="alert"
          class="mt-10 flex max-w-xl flex-col items-start gap-4 rounded-card border border-error/30 bg-error-soft p-6"
        >
          <div>
            <h1 class="text-xl font-bold">We couldn’t load this lesson</h1>
            <p class="mt-1 leading-relaxed">{{ error }}</p>
          </div>
          <div class="flex flex-wrap gap-3">
            <button type="button" :class="PRIMARY_BUTTON" @click="fetchLesson">Try again</button>
            <RouterLink :to="{ name: 'lessons' }" :class="SECONDARY_BUTTON">
              See all lessons
            </RouterLink>
          </div>
        </div>

        <div
          v-else-if="lesson && rendered"
          class="mt-8 grid gap-10 motion-safe:animate-rise lg:mt-12"
          :class="goals && 'xl:grid-cols-[minmax(0,1fr)_25rem] xl:items-end xl:gap-16'"
        >
          <div>
            <p class="flex flex-wrap items-center gap-x-5 gap-y-2">
              <span class="inline-flex items-center gap-2.5 font-semibold text-evergreen">
                <TierMeter :tier="lesson.tier" />
                {{ LESSON_TIER_LABELS[lesson.tier] }} lesson
              </span>
              <LevelDots :tier="lesson.tier" ring="ring-mist" class="text-sm text-quiet" />
            </p>
            <h1
              id="lesson-title"
              class="mt-5 max-w-[22ch] text-[clamp(2.25rem,1.6rem+2.4vw,3.75rem)] leading-[1.02] font-extrabold tracking-[-0.025em] text-balance"
            >
              {{ lesson.title }}
            </h1>
            <p class="mt-5 max-w-[56ch] text-xl leading-relaxed text-quiet">
              {{ lesson.summary }}
            </p>
            <dl class="mt-8 flex flex-wrap gap-y-4 divide-x divide-line-strong/25">
              <div
                v-for="fact in facts"
                :key="fact.label"
                class="flex flex-col-reverse px-5 first:pl-0 last:pr-0 sm:px-7"
              >
                <dt class="text-sm text-quiet">{{ fact.label }}</dt>
                <dd class="font-display text-xl font-bold tabular-nums sm:text-2xl">
                  {{ fact.value }}
                </dd>
              </div>
            </dl>
          </div>

          <aside
            v-if="goals"
            aria-labelledby="goals-title"
            class="rounded-card border border-line bg-surface p-6 shadow-[0_24px_48px_-32px_rgb(18_36_28/0.45)] sm:p-7"
          >
            <h2 id="goals-title" class="text-lg font-bold">{{ goals.title }}</h2>
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
        </div>

        <!-- Shaped like the header while the lesson loads. -->
        <template v-else>
          <p class="sr-only" role="status">Loading the lesson</p>
          <div
            aria-hidden="true"
            class="mt-8 grid gap-10 lg:mt-12 xl:grid-cols-[minmax(0,1fr)_25rem] xl:items-end xl:gap-16"
          >
            <div>
              <p class="flex flex-wrap items-center gap-x-5 gap-y-2">
                <span class="font-semibold"><SkeletonText tone="page" class="w-[11em]" /></span>
                <span class="text-sm"><SkeletonText tone="page" class="w-[14em]" /></span>
              </p>
              <p
                class="mt-5 max-w-[22ch] text-[clamp(2.25rem,1.6rem+2.4vw,3.75rem)] leading-[1.02] font-extrabold tracking-[-0.025em]"
              >
                <SkeletonText tone="page" class="w-full" />
                <br />
                <SkeletonText tone="page" class="w-3/5" />
              </p>
              <p class="mt-5 max-w-[56ch] text-xl leading-relaxed">
                <SkeletonText tone="page" class="w-full" />
                <br />
                <SkeletonText tone="page" class="w-1/2" />
              </p>
              <div class="mt-8 flex flex-wrap gap-y-4 divide-x divide-line-strong/25">
                <div
                  v-for="width in ['w-[3.5em]', 'w-[1em]', 'w-[6em]']"
                  :key="width"
                  class="flex flex-col px-5 first:pl-0 last:pr-0 sm:px-7"
                >
                  <span class="font-display text-xl font-bold sm:text-2xl">
                    <SkeletonText tone="page" :class="width" />
                  </span>
                  <span class="text-sm"><SkeletonText tone="page" class="w-[5.5em]" /></span>
                </div>
              </div>
            </div>

            <div
              class="rounded-card border border-line bg-surface p-6 shadow-[0_24px_48px_-32px_rgb(18_36_28/0.45)] sm:p-7"
            >
              <p class="text-lg font-bold"><SkeletonText class="w-[9em]" /></p>
              <ul class="mt-4 space-y-3.5">
                <li
                  v-for="width in ['w-full', 'w-4/5', 'w-11/12']"
                  :key="width"
                  class="flex gap-3 leading-snug"
                >
                  <span class="mt-px size-6 shrink-0 rounded-full bg-evergreen-soft" />
                  <SkeletonText class="mt-1" :class="width" />
                </li>
              </ul>
            </div>
          </div>
        </template>
      </div>
    </header>

    <div v-if="loading" class="bg-surface">
      <LessonBodySkeleton />
    </div>

    <template v-if="lesson && rendered && area">
      <div class="bg-surface">
        <div
          class="mx-auto grid max-w-7xl gap-12 px-4 py-12 sm:px-8 sm:py-16 lg:grid-cols-[13rem_minmax(0,1fr)] lg:px-10 lg:py-20 xl:grid-cols-[16rem_minmax(0,1fr)] xl:gap-20"
        >
          <div class="hidden lg:block">
            <LessonToc
              :sections="contents"
              :active-id="activeId"
              class="sticky top-[calc(var(--spacing-header)+2.5rem)]"
            />
          </div>

          <article ref="article" aria-labelledby="lesson-title" class="min-w-0 max-w-[44rem]">
            <img
              v-if="lesson.imageUrl"
              :src="lesson.imageUrl"
              :alt="lesson.title"
              class="mb-14 w-full rounded-card border border-line object-cover"
            />
            <LessonVideo
              v-if="lesson.videoUrl"
              :url="lesson.videoUrl"
              :title="lesson.title"
              class="mb-14"
            />
            <LessonBody :sections="sections" />
          </article>
        </div>
      </div>

      <section
        aria-labelledby="next-title"
        class="mx-auto max-w-7xl px-4 py-14 sm:px-8 sm:py-20 lg:px-10"
      >
        <div
          class="grid gap-12"
          :class="resources.length > 0 && 'lg:grid-cols-[minmax(0,1fr)_22rem] xl:gap-20'"
        >
          <div>
            <p class="flex items-center gap-3 font-semibold text-evergreen">
              <span class="h-px w-8 bg-current" aria-hidden="true" />
              Keep going
            </p>
            <h2
              id="next-title"
              class="mt-3 text-4xl leading-[1.05] font-bold tracking-[-0.025em] sm:text-5xl"
            >
              What’s next
            </h2>

            <!-- Shaped like the next lesson's card while the area's list loads. -->
            <div
              v-if="areaLoading"
              aria-hidden="true"
              class="mt-8 rounded-card border border-line bg-mist-soft p-6 sm:p-8"
            >
              <p class="text-sm font-semibold"><SkeletonText tone="soft" class="w-[14em]" /></p>
              <p class="mt-3 font-display text-2xl leading-tight font-bold sm:text-3xl">
                <SkeletonText tone="soft" class="w-4/5" />
              </p>
              <p class="mt-2 max-w-[52ch] leading-relaxed">
                <SkeletonText tone="soft" class="w-full" />
                <br />
                <SkeletonText tone="soft" class="w-1/2" />
              </p>
            </div>

            <RouterLink
              v-else-if="next?.lesson"
              :to="{ name: 'lesson', params: { slug: next.lesson.slug } }"
              class="group mt-8 flex flex-col gap-6 rounded-card bg-evergreen p-6 text-white transition-colors hover:bg-evergreen-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-evergreen sm:flex-row sm:items-end sm:justify-between sm:p-8"
            >
              <span class="block">
                <span class="flex items-center gap-2.5 text-sm font-semibold text-marigold">
                  <TierMeter :tier="next.tier" tone="on-green" />
                  Next step · {{ LESSON_TIER_LABELS[next.tier] }} lesson
                </span>
                <span
                  class="mt-3 block font-display text-2xl leading-tight font-bold text-balance sm:text-3xl"
                >
                  {{ next.lesson.title }}
                </span>
                <span class="mt-2 block max-w-[52ch] leading-relaxed text-white/80">
                  {{ next.lesson.summary }}
                </span>
              </span>
              <span
                aria-hidden="true"
                class="grid size-12 shrink-0 place-items-center rounded-full bg-surface text-evergreen"
              >
                <svg
                  viewBox="0 0 20 20"
                  class="size-5 fill-none stroke-current stroke-2 transition-transform group-hover:translate-x-0.5"
                >
                  <path d="M4 10h12m-5-5 5 5-5 5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
            </RouterLink>

            <div
              v-else-if="next"
              class="mt-8 rounded-card border border-dashed border-line-strong/50 bg-mist-soft p-6 sm:p-8"
            >
              <p class="flex items-center gap-2.5 text-sm font-semibold text-quiet">
                <TierMeter :tier="next.tier" class="opacity-50" />
                Next step · {{ LESSON_TIER_LABELS[next.tier] }} lesson
              </p>
              <p class="mt-3 font-display text-2xl leading-tight font-bold">Coming soon</p>
              <p class="mt-2 leading-relaxed text-quiet">
                The team is still writing it. In the meantime, try a lesson from another area.
              </p>
            </div>

            <div v-else-if="isLastTier" class="mt-8 rounded-card bg-ink p-6 text-white sm:p-8">
              <p class="flex items-center gap-2.5 text-sm font-semibold text-marigold">
                <TierMeter :tier="lesson.tier" tone="on-green" />
                Top of {{ area.label }}
              </p>
              <p class="mt-3 font-display text-2xl leading-tight font-bold sm:text-3xl">
                That’s the last lesson in this area.
              </p>
              <p class="mt-2 max-w-[52ch] leading-relaxed text-white/75">
                There are {{ AREA_CODES.length - 1 }} more areas to work on. Pick up where your
                level is lowest.
              </p>
              <RouterLink
                :to="{ name: 'lessons' }"
                class="mt-6 inline-flex min-h-12 items-center gap-2 rounded-control bg-surface px-6 font-semibold text-evergreen hover:bg-evergreen-soft"
              >
                See all lessons
              </RouterLink>
            </div>
          </div>

          <aside v-if="resources.length" aria-labelledby="resources-title" class="lg:pt-2">
            <h3 id="resources-title" class="text-xl font-bold">Learn more</h3>
            <p class="mt-1 text-sm text-quiet">Other sites, opened in a new tab.</p>
            <ul class="mt-5 divide-y divide-line border-y border-line">
              <li v-for="resource in resources" :key="resource.url">
                <a
                  :href="resource.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="group flex items-start justify-between gap-4 py-4"
                >
                  <span class="min-w-0">
                    <span
                      class="block leading-snug font-semibold text-evergreen decoration-evergreen/40 underline-offset-2 group-hover:underline"
                    >
                      {{ resource.label }}
                    </span>
                    <span v-if="resource.site" class="mt-1 block truncate text-sm text-quiet">
                      {{ resource.site }}
                    </span>
                    <span class="sr-only">(opens in a new tab)</span>
                  </span>
                  <svg
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                    class="mt-1 size-4 shrink-0 fill-none stroke-quiet stroke-2 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:stroke-evergreen"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M5 11 11 5M6 5h5v5" />
                  </svg>
                </a>
              </li>
            </ul>
          </aside>
        </div>

        <div v-if="tiers.length || areaLoading" class="mt-16">
          <h3 class="text-xl font-bold">All {{ area.label }} lessons</h3>
          <ol class="mt-5 grid gap-4 md:grid-cols-3">
            <template v-if="areaLoading">
              <li v-for="tier in LESSON_TIERS" :key="tier">
                <LessonTileSkeleton :tier="tier" />
              </li>
            </template>
            <li v-for="item in tiers" v-else :key="item.tier">
              <LessonTile :tier="item.tier" :lesson="item.lesson" :current="item.current" />
            </li>
          </ol>
        </div>
      </section>
    </template>
  </div>
</template>
