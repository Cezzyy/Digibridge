<script setup lang="ts">
import { AREA_LABELS, LESSON_TIER_LABELS, type Level } from '@digibridge/shared'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import LessonCard from '../../components/results/LessonCard.vue'
import LevelBadge from '../../components/results/LevelBadge.vue'
import RadarChart from '../../components/results/RadarChart.vue'
import ScoreBar from '../../components/results/ScoreBar.vue'
import StartLayout from '../../components/start/StartLayout.vue'
import StartSteps from '../../components/start/StartSteps.vue'
import { useResult, type AreaResult } from '../../composables/useResult'
import { PRIMARY_BUTTON } from '../../lib/buttons'
import { wholePct } from '../../lib/levels'
import { useSessionStore } from '../../stores/session'

// The last step: the overall level, a radar chart of the 3 areas, and each area's score, level
// and lessons (RES-01, RES-02). Scores only, never which answers were right (RES-05). The `step`
// guard lets in only a respondent whose attempt is submitted or expired; online they can come
// back to it anytime (RES-03). Loaded lazily by the router, so Chart.js isn't in the first load.
const session = useSessionStore()
const router = useRouter()
const { result, error, load } = useResult()

async function fetchResult() {
  // Voided by the team or no longer this account's: /me is fresh again, and home sorts it out.
  if ((await load()) === 'moved') await router.replace({ name: 'home' })
}
void fetchResult()

const name = computed(() => session.me?.respondent?.fullName ?? session.me?.profile.fullName)

// What a level means, in a line before the area's lessons.
const LEVEL_NOTE: Record<Level, string> = {
  beginner: 'You’re just getting started here.',
  basic: 'You know the basics.',
  intermediate: 'You’re doing well here.',
  advanced: 'You’re strong here.',
}

/** "Start with the Foundations lesson, then try Intermediate.", from the area's lessons. */
function nextSteps(area: AreaResult) {
  const [first, next] = area.lessons.map((pick) => LESSON_TIER_LABELS[pick.tier])
  if (!first) return ''
  return next
    ? `Start with the ${first} lesson, then try ${next}.`
    : `The ${first} lesson is the one for you.`
}

const areas = computed(
  () =>
    result.value?.areas.map((area, i) => ({
      ...area,
      number: String(i + 1).padStart(2, '0'),
      label: AREA_LABELS[area.area],
      shown: wholePct(area.pct),
      advice: `${LEVEL_NOTE[area.level]} ${nextSteps(area)}`,
    })) ?? [],
)

// The highest and lowest area, when they differ. Ties go to the first in the areas' order.
const highlights = computed(() => {
  const list = areas.value
  if (list.length < 2) return null
  const strongest = list.reduce((best, a) => (a.pct > best.pct ? a : best))
  const focus = list.reduce((low, a) => (a.pct < low.pct ? a : low))
  return strongest.pct === focus.pct ? null : { strongest, focus }
})

const finishedOn = computed(() =>
  result.value
    ? new Intl.DateTimeFormat('en-PH', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'Asia/Manila',
      }).format(new Date(result.value.submittedAt))
    : '',
)
</script>

<template>
  <StartLayout>
    <template #rail>
      <StartSteps current="results" class="mb-6 lg:order-1 lg:mt-10 lg:mb-0" />

      <h1
        class="text-[clamp(2rem,1.5rem+1.6vw,3.25rem)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance motion-safe:animate-rise"
      >
        Well done<template v-if="name">, {{ name }}</template>
      </h1>
      <p
        class="mt-3 text-lg leading-relaxed text-white/85 lg:mt-4 motion-safe:animate-rise motion-safe:[animation-delay:80ms]"
      >
        <template v-if="result?.status === 'expired'">
          Time ran out, so we scored the answers you’d saved.
        </template>
        Here’s your level in each skill area, and the lessons that fit it.
      </p>

      <!-- The overall level, on white so every level's color shows on the green panel. -->
      <div
        v-if="result"
        class="mt-6 rounded-card bg-surface p-5 text-ink shadow-[0_8px_24px_rgb(0_0_0/0.18)] motion-safe:animate-rise motion-safe:[animation-delay:160ms] sm:max-w-md lg:max-w-none"
      >
        <p class="text-sm font-semibold text-quiet">Your overall level</p>
        <div class="mt-2 flex flex-wrap items-center justify-between gap-3">
          <LevelBadge :level="result.overall.level" large />
          <p class="font-display text-4xl leading-none font-bold tabular-nums">
            {{ wholePct(result.overall.pct) }}%
          </p>
        </div>
        <ScoreBar :pct="result.overall.pct" :level="result.overall.level" class="mt-4" />
        <p class="mt-2 text-sm text-quiet">
          {{ result.overall.points }} of {{ result.overall.maxPoints }} points across all areas
        </p>
      </div>

      <p v-if="result" class="mt-auto hidden pt-10 text-sm text-white/80 lg:order-2 lg:block">
        Finished {{ finishedOn }}
      </p>
    </template>

    <!-- Couldn't load: say so in place, with a way to try again. -->
    <div
      v-if="error"
      role="alert"
      class="mx-auto flex max-w-xl flex-col items-start gap-4 rounded-card border border-error/30 bg-error-soft p-6"
    >
      <div>
        <h2 class="text-xl font-bold">We couldn’t load your results</h2>
        <p class="mt-1 leading-relaxed">{{ error }}</p>
      </div>
      <button type="button" :class="PRIMARY_BUTTON" @click="fetchResult">Try again</button>
    </div>

    <!-- Loading: the page's shape, quietly pulsing. -->
    <div v-else-if="!result" class="space-y-6" aria-busy="true">
      <p class="sr-only" role="status">Loading your results</p>
      <div class="h-96 animate-pulse rounded-card bg-mist-soft motion-reduce:animate-none" />
      <div class="h-56 animate-pulse rounded-card bg-mist-soft motion-reduce:animate-none" />
    </div>

    <div v-else class="space-y-10">
      <!-- The 3 areas at a glance. -->
      <section
        aria-labelledby="map-title"
        class="rounded-card border border-line bg-surface p-5 motion-safe:animate-rise motion-safe:[animation-delay:120ms] sm:p-7"
      >
        <h2 id="map-title" class="text-2xl leading-tight font-bold sm:text-3xl">Your skill map</h2>
        <p class="mt-1 text-quiet">
          The further out a point, the higher your score. Each ring is a level.
        </p>

        <div
          class="mt-6 grid grid-cols-[minmax(0,1fr)] items-center gap-8 md:grid-cols-[minmax(0,1fr)_16rem] lg:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_17rem] 2xl:grid-cols-[minmax(0,1fr)_20rem]"
        >
          <RadarChart :areas="result.areas" />

          <dl
            v-if="highlights"
            class="grid gap-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-1"
          >
            <div class="rounded-control bg-mist-soft px-4 py-3.5">
              <dt class="text-sm font-semibold text-quiet">Your strongest area</dt>
              <dd class="mt-1 font-semibold text-evergreen">{{ highlights.strongest.label }}</dd>
              <dd class="mt-0.5 text-sm text-quiet">
                {{ highlights.strongest.shown }}% · {{ highlights.strongest.points }} of
                {{ highlights.strongest.maxPoints }} points
              </dd>
            </div>
            <div class="rounded-control bg-marigold-soft px-4 py-3.5">
              <dt class="text-sm font-semibold text-marigold-text">Work on this first</dt>
              <dd class="mt-1 font-semibold">{{ highlights.focus.label }}</dd>
              <dd class="mt-0.5 text-sm text-quiet">
                {{ highlights.focus.shown }}% · {{ highlights.focus.points }} of
                {{ highlights.focus.maxPoints }} points
              </dd>
            </div>
          </dl>
          <p v-else class="rounded-control bg-mist-soft px-4 py-3.5 leading-relaxed">
            You scored the same in every area, so start with whichever one you like.
          </p>
        </div>
      </section>

      <!-- Each area: score, level and its lessons. -->
      <section aria-labelledby="areas-title">
        <h2 id="areas-title" class="text-2xl leading-tight font-bold sm:text-3xl">
          Your lessons, area by area
        </h2>
        <p class="mt-1 text-quiet">Each lesson matches your level in that area.</p>

        <ol class="mt-6 grid gap-4 2xl:grid-cols-3">
          <li
            v-for="(area, i) in areas"
            :key="area.area"
            class="@container flex flex-col rounded-card border border-line bg-surface p-5 motion-safe:animate-rise sm:p-6"
            :style="{ animationDelay: `${200 + i * 80}ms` }"
          >
            <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <h3 class="flex min-w-0 gap-3 text-xl leading-snug font-bold">
                <span class="font-display text-marigold-text tabular-nums">{{ area.number }}</span>
                <span>{{ area.label }}</span>
              </h3>
              <LevelBadge :level="area.level" />
            </div>

            <div class="mt-4 flex items-center gap-4">
              <ScoreBar :pct="area.pct" :level="area.level" class="flex-1" />
              <p class="font-display text-lg font-bold tabular-nums">{{ area.shown }}%</p>
            </div>
            <p class="mt-1.5 text-sm text-quiet">
              {{ area.points }} of {{ area.maxPoints }} points
            </p>

            <p class="mt-4 leading-relaxed">{{ area.advice }}</p>
            <ul class="mt-4 grid flex-1 gap-3 @lg:grid-cols-2">
              <li v-for="pick in area.lessons" :key="pick.tier">
                <LessonCard :pick="pick" />
              </li>
            </ul>
          </li>
        </ol>
      </section>

      <!-- Why there are no marks per question (RES-05). -->
      <p class="flex max-w-[68ch] gap-3 leading-relaxed text-quiet">
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          class="mt-0.5 size-5 shrink-0 fill-none stroke-evergreen stroke-2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        <span>
          Your results show your level, not which answers were right or wrong. That keeps the
          questions fair for everyone who takes it after you.
        </span>
      </p>
    </div>
  </StartLayout>
</template>
