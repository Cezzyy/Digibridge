<script setup lang="ts">
import { AREA_CODES, AREA_LABELS, LESSON_TIER_LABELS, LESSON_TIERS } from '@digibridge/shared'
import { computed } from 'vue'
import { AREA_DETAILS } from '../../components/landing/areas'
import LessonTile from '../../components/lessons/LessonTile.vue'
import LessonTileSkeleton from '../../components/lessons/LessonTileSkeleton.vue'
import LevelDots from '../../components/lessons/LevelDots.vue'
import TierMeter from '../../components/lessons/TierMeter.vue'
import { useLessons } from '../../composables/useLessons'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../lib/buttons'
import { useSessionStore } from '../../stores/session'

// The lessons library (LES-01): the 3 areas, each with its Foundations, Intermediate and
// Advanced lesson. The header explains how the 3 tiers build up and which levels each is for.
// Open to everyone, signed in or not (LES-03). A tier with no published lesson yet shows
// "Coming soon". Each area's heading is `#area-<code>`, which a lesson's breadcrumb links to.
const session = useSessionStore()
const { lessons, error, load } = useLessons()
void load()

const areas = computed(() =>
  AREA_CODES.map((code, i) => ({
    code,
    number: String(i + 1).padStart(2, '0'),
    label: AREA_LABELS[code],
    summary: AREA_DETAILS[code].summary,
    tiers: LESSON_TIERS.map((tier) => ({
      tier,
      lesson: lessons.value?.find((l) => l.area === code && l.tier === tier) ?? null,
    })),
  })),
)

const CTA =
  'inline-flex min-h-12 items-center gap-2 rounded-control bg-surface px-6 font-semibold text-evergreen transition-colors hover:bg-evergreen-soft'
</script>

<template>
  <main>
    <header class="bg-linear-to-b from-evergreen to-evergreen-hover text-white">
      <div
        class="mx-auto grid max-w-7xl gap-12 px-4 py-12 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-end lg:gap-16 lg:px-10 lg:py-20"
      >
        <div>
          <p class="flex items-center gap-3 font-semibold text-marigold motion-safe:animate-rise">
            <span class="h-px w-8 bg-current" aria-hidden="true" />
            Lessons library
          </p>
          <h1
            class="mt-4 text-[clamp(2.5rem,1.6rem+3vw,4.5rem)] leading-[0.98] font-extrabold tracking-[-0.025em] text-balance motion-safe:animate-rise motion-safe:[animation-delay:80ms]"
          >
            Learn the next step for your level.
          </h1>
          <p
            class="mt-5 max-w-xl text-lg leading-relaxed text-white/80 motion-safe:animate-rise motion-safe:[animation-delay:160ms]"
          >
            Short lessons in {{ AREA_CODES.length }} skill areas, with real examples from school,
            group chats and your phone. Read any of them, anytime. No sign-in needed.
          </p>

          <div
            class="mt-8 flex flex-wrap gap-3 motion-safe:animate-rise motion-safe:[animation-delay:240ms]"
          >
            <RouterLink v-if="session.attemptFinished" :to="{ name: 'results' }" :class="CTA">
              See the lessons for your level
            </RouterLink>
            <RouterLink
              v-else-if="!session.isSignedIn && !session.loading"
              :to="{ name: 'sign-in' }"
              :class="CTA"
            >
              Check your level first
            </RouterLink>
          </div>
        </div>

        <!-- How the tiers build up: the key for the bars and dots on every lesson. -->
        <section
          aria-labelledby="tiers-title"
          class="rounded-card bg-white/[0.07] p-6 ring-1 ring-white/15 motion-safe:animate-rise motion-safe:[animation-delay:320ms] sm:p-7"
        >
          <h2 id="tiers-title" class="text-lg font-bold">
            Every area has {{ LESSON_TIERS.length }} lessons
          </h2>
          <ol class="mt-5 space-y-4">
            <li v-for="tier in LESSON_TIERS" :key="tier" class="flex items-center gap-4">
              <span
                class="grid size-10 shrink-0 place-items-center rounded-control bg-white/10"
                aria-hidden="true"
              >
                <TierMeter :tier="tier" tone="on-green" />
              </span>
              <span class="min-w-0">
                <span class="block font-semibold">{{ LESSON_TIER_LABELS[tier] }}</span>
                <LevelDots :tier="tier" ring="ring-white/40" class="text-sm text-white/75" />
              </span>
            </li>
          </ol>
        </section>
      </div>
    </header>

    <div class="mx-auto max-w-7xl px-4 py-14 sm:px-8 sm:py-20 lg:px-10">
      <!-- Couldn't load: say so in place, with a way to try again. -->
      <div
        v-if="error"
        role="alert"
        class="flex max-w-xl flex-col items-start gap-4 rounded-card border border-error/30 bg-error-soft p-6"
      >
        <div>
          <h2 class="text-xl font-bold">We couldn’t load the lessons</h2>
          <p class="mt-1 leading-relaxed">{{ error }}</p>
        </div>
        <div class="flex flex-wrap gap-3">
          <button type="button" :class="PRIMARY_BUTTON" @click="load()">Try again</button>
          <RouterLink
            :to="{ name: session.isSignedIn ? 'home' : 'landing' }"
            :class="SECONDARY_BUTTON"
          >
            Go home
          </RouterLink>
        </div>
      </div>

      <div v-else :aria-busy="!lessons">
        <p class="sr-only" role="status">{{ lessons ? '' : 'Loading the lessons' }}</p>

        <section
          v-for="(area, i) in areas"
          :key="area.code"
          :aria-labelledby="`area-${area.code}`"
          class="border-t border-line py-14 first:border-t-0 first:pt-0 last:pb-0 sm:py-16 motion-safe:animate-rise"
          :style="{ animationDelay: `${120 + i * 80}ms` }"
        >
          <div
            class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-end lg:gap-16"
          >
            <h2
              :id="`area-${area.code}`"
              class="flex items-start gap-4 text-3xl leading-[1.1] font-bold tracking-[-0.02em] text-balance sm:gap-5 sm:text-4xl"
            >
              <span
                class="font-display text-[1.4em] leading-[0.8] font-extrabold text-marigold-text tabular-nums"
              >
                {{ area.number }}
              </span>
              <span>{{ area.label }}</span>
            </h2>
            <p class="text-lg leading-relaxed text-quiet">{{ area.summary }}</p>
          </div>

          <ol class="mt-8 grid gap-4 md:grid-cols-3 lg:gap-5">
            <li v-for="item in area.tiers" :key="item.tier">
              <LessonTile v-if="lessons" :tier="item.tier" :lesson="item.lesson" />
              <LessonTileSkeleton v-else :tier="item.tier" />
            </li>
          </ol>
        </section>
      </div>
    </div>
  </main>
</template>
