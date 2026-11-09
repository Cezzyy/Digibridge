<script setup lang="ts">
import { AREA_CODES, AREA_LABELS, LESSON_TIERS } from '@digibridge/shared'
import { computed } from 'vue'
import LessonTile from '../../components/lessons/LessonTile.vue'
import SkeletonText from '../../components/results/SkeletonText.vue'
import { useLessons } from '../../composables/useLessons'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../lib/buttons'
import { useSessionStore } from '../../stores/session'

// The lessons library (LES-01): the 3 areas, each with its Foundations, Intermediate and
// Advanced lesson. Open to everyone, signed in or not (LES-03). A tier with no published
// lesson yet shows "Coming soon".
const session = useSessionStore()
const { lessons, error, load } = useLessons()
void load()

const areas = computed(() =>
  AREA_CODES.map((code, i) => ({
    code,
    number: String(i + 1).padStart(2, '0'),
    label: AREA_LABELS[code],
    tiers: LESSON_TIERS.map((tier) => ({
      tier,
      lesson: lessons.value?.find((l) => l.area === code && l.tier === tier) ?? null,
    })),
  })),
)
</script>

<template>
  <main>
    <header class="bg-linear-to-b from-evergreen to-evergreen-hover text-white">
      <div class="mx-auto max-w-6xl px-4 py-10 sm:px-8 sm:py-14 lg:px-10">
        <p class="font-semibold text-marigold motion-safe:animate-rise">Lessons library</p>
        <h1
          class="mt-2 text-[clamp(2rem,1.5rem+1.6vw,3.25rem)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance motion-safe:animate-rise motion-safe:[animation-delay:80ms]"
        >
          Lessons for every level
        </h1>
        <p
          class="mt-4 max-w-2xl text-lg leading-relaxed text-white/85 motion-safe:animate-rise motion-safe:[animation-delay:160ms]"
        >
          Short lessons in 3 skill areas. Each area has a Foundations, an Intermediate and an
          Advanced lesson. Read any of them, anytime.
        </p>

        <div
          class="mt-6 flex flex-wrap gap-3 motion-safe:animate-rise motion-safe:[animation-delay:240ms]"
        >
          <RouterLink
            v-if="session.attemptFinished"
            :to="{ name: 'results' }"
            class="inline-flex min-h-12 items-center rounded-control bg-surface px-6 font-semibold text-evergreen hover:bg-evergreen-soft"
          >
            See the lessons for your level
          </RouterLink>
          <RouterLink
            v-else-if="!session.isSignedIn && !session.loading"
            :to="{ name: 'sign-in' }"
            class="inline-flex min-h-12 items-center rounded-control bg-surface px-6 font-semibold text-evergreen hover:bg-evergreen-soft"
          >
            Check your level first
          </RouterLink>
        </div>
      </div>
    </header>

    <div class="mx-auto max-w-6xl px-4 py-10 sm:px-8 lg:px-10">
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

      <div v-else class="space-y-12" :aria-busy="!lessons">
        <p class="sr-only" role="status">{{ lessons ? '' : 'Loading the lessons' }}</p>

        <section
          v-for="(area, i) in areas"
          :key="area.code"
          :aria-labelledby="`area-${area.code}`"
          class="motion-safe:animate-rise"
          :style="{ animationDelay: `${120 + i * 80}ms` }"
        >
          <h2
            :id="`area-${area.code}`"
            class="flex gap-3 text-2xl leading-tight font-bold sm:text-3xl"
          >
            <span class="font-display text-marigold-text tabular-nums">{{ area.number }}</span>
            <span>{{ area.label }}</span>
          </h2>

          <ul class="mt-5 grid gap-4 md:grid-cols-3">
            <li v-for="item in area.tiers" :key="item.tier">
              <LessonTile v-if="lessons" :tier="item.tier" :lesson="item.lesson" />
              <!-- Shaped like a lesson tile while the list loads. -->
              <div
                v-else
                aria-hidden="true"
                class="flex h-full flex-col rounded-card border border-line bg-surface p-4 sm:p-5"
              >
                <p class="flex text-sm">
                  <span class="h-6 w-24 rounded-full bg-mist motion-safe:animate-skeleton" />
                </p>
                <p class="mt-3 text-lg font-semibold"><SkeletonText class="w-[12em]" /></p>
                <p class="mt-1 leading-relaxed">
                  <SkeletonText class="w-full" />
                  <br />
                  <SkeletonText class="w-2/3" />
                </p>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </main>
</template>
