<script setup lang="ts">
import { AREA_CODES, AREA_LABELS, LESSON_TIER_LABELS, type Level } from '@digibridge/shared'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import LessonCard from '../../components/results/LessonCard.vue'
import LevelBadge from '../../components/results/LevelBadge.vue'
import RadarChart from '../../components/results/RadarChart.vue'
import RadarChartSkeleton from '../../components/results/RadarChartSkeleton.vue'
import ScoreBar from '../../components/results/ScoreBar.vue'
import SkeletonText from '../../components/results/SkeletonText.vue'
import StartLayout from '../../components/start/StartLayout.vue'
import StartSteps from '../../components/start/StartSteps.vue'
import SusForm from '../../components/SusForm.vue'
import { useResult, type AreaResult } from '../../composables/useResult'
import { PRIMARY_BUTTON } from '../../lib/buttons'
import { wholePct } from '../../lib/levels'
import { useSessionStore } from '../../stores/session'

// The last step: the overall level, a radar chart of the 3 areas, and each area's score, level
// and lessons (RES-01, RES-02). Scores only, never which answers were right (RES-05). The `step`
// guard lets in only a respondent whose attempt is submitted or expired; online they can come
// back to it anytime (RES-03). The usability survey is an optional card at the end (SUS-02).
// Loaded lazily by the router, so Chart.js isn't in the first load.
const session = useSessionStore()
const router = useRouter()
const { result, error, load } = useResult()

async function fetchResult() {
  // Voided by the team or no longer this account's: /me is fresh again, and home sorts it out.
  if ((await load()) === 'moved') await router.replace({ name: 'home' })
}
void fetchResult()

// The usability survey sits under the results until it's answered (SUS-02). Skip hides it for
// this visit only, so it's offered again next time.
const susSkipped = ref(false)
const susOpen = computed(() => !!result.value && !result.value.susAnswered && !susSkipped.value)

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

const number = (i: number) => String(i + 1).padStart(2, '0')

const areas = computed(
  () =>
    result.value?.areas.map((area, i) => ({
      ...area,
      number: number(i),
      label: AREA_LABELS[area.area],
      shown: wholePct(area.pct),
      advice: `${LEVEL_NOTE[area.level]} ${nextSteps(area)}`,
    })) ?? [],
)

// While loading, the area cards already show each area's number and name: the API lists the
// areas in this order too. Keyed by area, so each card stays in place when its scores come in.
const cards = computed(() =>
  result.value
    ? areas.value.map((area) => ({
        key: area.area,
        number: area.number,
        label: area.label,
        data: area,
      }))
    : AREA_CODES.map((code, i) => ({
        key: code,
        number: number(i),
        label: AREA_LABELS[code],
        data: null,
      })),
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

      <!-- The overall level, on white so every level's color shows on the green panel. While
           loading, the card is already there with placeholders where the level and score go. -->
      <div
        v-if="result || !error"
        class="mt-6 rounded-card bg-surface p-5 text-ink shadow-[0_8px_24px_rgb(0_0_0/0.18)] motion-safe:animate-rise motion-safe:[animation-delay:160ms] sm:max-w-md lg:max-w-none"
      >
        <p class="text-sm font-semibold text-quiet">Your overall level</p>
        <div class="mt-2 flex flex-wrap items-center justify-between gap-3">
          <template v-if="result">
            <LevelBadge :level="result.overall.level" large />
            <p class="font-display text-4xl leading-none font-bold tabular-nums">
              {{ wholePct(result.overall.pct) }}%
            </p>
          </template>
          <template v-else>
            <span
              aria-hidden="true"
              class="h-11 w-40 rounded-full bg-mist motion-safe:animate-skeleton"
            />
            <p class="font-display text-4xl leading-none font-bold">
              <SkeletonText class="w-[1.9em]" />
            </p>
          </template>
        </div>
        <ScoreBar
          v-if="result"
          :pct="result.overall.pct"
          :level="result.overall.level"
          class="mt-4"
        />
        <div
          v-else
          aria-hidden="true"
          class="mt-4 h-2.5 rounded-full bg-track motion-safe:animate-skeleton"
        />
        <p class="mt-2 text-sm text-quiet">
          <template v-if="result">
            {{ result.overall.points }} of {{ result.overall.maxPoints }} points across all areas
          </template>
          <SkeletonText v-else class="w-[12.5em]" />
        </p>
      </div>

      <p
        v-if="result || !error"
        class="mt-auto hidden pt-10 text-sm text-white/80 lg:order-2 lg:block"
      >
        Finished
        <template v-if="result">{{ finishedOn }}</template>
        <SkeletonText v-else tone="rail" class="w-[12em]" />
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

    <!-- The page is drawn at once: headings, area names and notes are known before the scores
         come in, and each part that waits on them holds a placeholder of its own size. -->
    <div v-else class="space-y-10" :aria-busy="!result">
      <p class="sr-only" role="status">{{ result ? '' : 'Loading your results' }}</p>

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
          <RadarChart v-if="result" :areas="result.areas" />
          <RadarChartSkeleton v-else />

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
          <p v-else-if="result" class="rounded-control bg-mist-soft px-4 py-3.5 leading-relaxed">
            You scored the same in every area, so start with whichever one you like.
          </p>
          <div
            v-else
            aria-hidden="true"
            class="grid gap-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-1"
          >
            <div class="rounded-control bg-mist-soft px-4 py-3.5">
              <p class="text-sm font-semibold text-quiet">Your strongest area</p>
              <p class="mt-1 font-semibold"><SkeletonText tone="soft" class="w-[12em]" /></p>
              <p class="mt-0.5 text-sm"><SkeletonText tone="soft" class="w-[10em]" /></p>
            </div>
            <div class="rounded-control bg-marigold-soft px-4 py-3.5">
              <p class="text-sm font-semibold text-marigold-text">Work on this first</p>
              <p class="mt-1 font-semibold"><SkeletonText tone="marigold" class="w-[9em]" /></p>
              <p class="mt-0.5 text-sm"><SkeletonText tone="marigold" class="w-[10em]" /></p>
            </div>
          </div>
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
            v-for="(card, i) in cards"
            :key="card.key"
            class="@container flex flex-col rounded-card border border-line bg-surface p-5 motion-safe:animate-rise sm:p-6"
            :style="{ animationDelay: `${200 + i * 80}ms` }"
          >
            <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <h3 class="flex min-w-0 gap-3 text-xl leading-snug font-bold">
                <span class="font-display text-marigold-text tabular-nums">{{ card.number }}</span>
                <span>{{ card.label }}</span>
              </h3>
              <LevelBadge v-if="card.data" :level="card.data.level" />
              <span
                v-else
                aria-hidden="true"
                class="h-6 w-26 rounded-full bg-mist motion-safe:animate-skeleton"
              />
            </div>

            <template v-if="card.data">
              <div class="mt-4 flex items-center gap-4">
                <ScoreBar :pct="card.data.pct" :level="card.data.level" class="flex-1" />
                <p class="font-display text-lg font-bold tabular-nums">{{ card.data.shown }}%</p>
              </div>
              <p class="mt-1.5 text-sm text-quiet">
                {{ card.data.points }} of {{ card.data.maxPoints }} points
              </p>

              <p class="mt-4 leading-relaxed">{{ card.data.advice }}</p>
              <ul class="mt-4 grid flex-1 gap-3 @lg:grid-cols-2">
                <li v-for="pick in card.data.lessons" :key="pick.tier">
                  <LessonCard :pick="pick" />
                </li>
              </ul>
            </template>

            <!-- Most levels get 2 lessons, so the placeholder shows 2, shaped like the "Coming
                 soon" card. The advice fits on one line in a wide card and takes about two in a
                 narrow one. -->
            <div v-else aria-hidden="true" class="flex flex-1 flex-col">
              <div class="mt-4 flex items-center gap-4">
                <div class="h-2.5 flex-1 rounded-full bg-track motion-safe:animate-skeleton" />
                <p class="font-display text-lg font-bold"><SkeletonText class="w-[2.2em]" /></p>
              </div>
              <p class="mt-1.5 text-sm"><SkeletonText class="w-[8em]" /></p>

              <p class="mt-4 leading-relaxed">
                <SkeletonText class="w-full @2xl:w-[37em]" />
                <br class="@2xl:hidden" />
                <SkeletonText class="w-1/2 @2xl:hidden" />
              </p>
              <ul class="mt-4 grid flex-1 gap-3 @lg:grid-cols-2">
                <li
                  v-for="n in 2"
                  :key="n"
                  class="flex flex-col rounded-card border border-line bg-surface p-4"
                >
                  <p class="flex text-sm">
                    <span class="h-6 w-20 rounded-full bg-mist motion-safe:animate-skeleton" />
                  </p>
                  <p class="mt-3 font-semibold"><SkeletonText class="w-[9em]" /></p>
                  <p class="mt-1 leading-relaxed"><SkeletonText class="w-[16em]" /></p>
                </li>
              </ul>
            </div>
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

      <SusForm
        v-if="result && susOpen"
        :attempt-id="result.id"
        class="motion-safe:animate-rise"
        @skip="susSkipped = true"
      />
    </div>
  </StartLayout>
</template>
