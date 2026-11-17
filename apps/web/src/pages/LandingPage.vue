<script setup lang="ts">
import {
  AREA_CODES,
  AREA_MAX_POINTS,
  ATTEMPT_DURATION_MINUTES,
  DATA_KEPT_UNTIL,
  ITEMS_PER_AREA,
  ITEMS_PER_ATTEMPT,
  LEVELS,
} from '@digibridge/shared'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import AreaSlides from '../components/landing/AreaSlides.vue'
import BridgeArt from '../components/landing/BridgeArt.vue'
import HowItWorks from '../components/landing/HowItWorks.vue'
import LevelExplorer from '../components/landing/LevelExplorer.vue'
import SampleQuestion from '../components/landing/SampleQuestion.vue'
import SectionEyebrow from '../components/landing/SectionEyebrow.vue'
import SiteFooter from '../components/SiteFooter.vue'
import SiteHeader from '../components/SiteHeader.vue'
import SwashWord from '../components/SwashWord.vue'
import { prefersReducedMotion, tween, vReveal } from '../lib/motion'
import { useSessionStore } from '../stores/session'

// What DigiBridge is, for signed-out visitors. Signed-in users never see it; the `guest` guard
// sends them to /home. The page draws its own top bar (`hideHeader` in router.ts).
const session = useSessionStore()

const NAV_LINKS = [
  { hash: '#areas', label: 'What it checks' },
  { hash: '#how', label: 'How it works' },
  { hash: '#privacy', label: 'Privacy' },
]

const FACTS = [
  { value: ITEMS_PER_ATTEMPT, label: 'questions' },
  { value: ATTEMPT_DURATION_MINUTES, label: 'minutes' },
  { value: AREA_CODES.length, label: 'skill areas' },
]

// The hero's numbers count up as the page opens.
const factsShown = ref(FACTS.map((fact) => fact.value))
let stopCounting: (() => void) | undefined
onMounted(() => {
  if (prefersReducedMotion()) return
  factsShown.value = FACTS.map(() => 0)
  stopCounting = tween(
    1200,
    (t) => (factsShown.value = FACTS.map((fact) => Math.round(fact.value * t))),
    450,
  )
})
onBeforeUnmount(() => stopCounting?.())

const PRIVACY = [
  { icon: 'lock', text: 'Only the DigiBridge team can see your answers.' },
  {
    icon: 'hide',
    text: 'You choose whether the team can see who you are. If you say no, you show up as Hidden.',
  },
  {
    icon: 'notice',
    text: 'You read and agree to the privacy notice before you start. If you decline, it ends there.',
  },
  {
    icon: 'calendar',
    text: `We keep your data until ${DATA_KEPT_UNTIL}, then delete it. You can ask for it to be deleted sooner.`,
  },
] as const

// On phones, a Get started bar slides up once the hero's button scrolls away, and hides again
// at the closing section, which has its own button.
const heroCta = useTemplateRef<HTMLElement>('heroCta')
const closing = useTemplateRef<HTMLElement>('closing')
const heroCtaInView = ref(true)
const closingInView = ref(false)
const showDock = computed(() => !heroCtaInView.value && !closingInView.value)
let observer: IntersectionObserver | undefined

onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.target === heroCta.value) heroCtaInView.value = entry.isIntersecting
      else closingInView.value = entry.isIntersecting
    }
  })
  if (heroCta.value) observer.observe(heroCta.value)
  if (closing.value) observer.observe(closing.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="overflow-x-clip">
    <SiteHeader>
      <RouterLink
        v-for="link in NAV_LINKS"
        :key="link.hash"
        :to="{ hash: link.hash }"
        class="hidden min-h-11 items-center rounded-control px-3 font-semibold text-quiet transition-colors hover:text-ink md:inline-flex"
      >
        {{ link.label }}
      </RouterLink>
      <!-- From `sm`: on phones there's no room beside Sign in, so the footer links it instead. -->
      <RouterLink
        :to="{ name: 'lessons' }"
        class="hidden min-h-11 items-center rounded-control px-3 font-semibold text-quiet transition-colors hover:text-ink sm:inline-flex"
      >
        Lessons
      </RouterLink>
      <RouterLink
        :to="{ name: 'sign-in' }"
        class="ml-2 inline-flex min-h-11 items-center rounded-control border border-line-strong px-4 font-semibold text-evergreen transition-colors hover:bg-evergreen-soft"
      >
        Sign in
      </RouterLink>
    </SiteHeader>

    <!-- Hero: as tall as its content, with the bridge right under it as its floor. Phones stack
         it; tablets put the heading across the top and the card beside the buttons; desktops put
         the card beside everything. -->
    <section class="relative" aria-labelledby="hero-title">
      <div
        class="hero-grid mx-auto grid w-full max-w-7xl px-4 pt-6 pb-14 sm:px-6 sm:pt-10 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:gap-x-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:px-8 lg:pb-16"
      >
        <div class="[grid-area:intro]">
          <h1
            id="hero-title"
            class="text-[clamp(2.75rem,1.5rem+4.6vw,5.25rem)] leading-[0.95] font-extrabold tracking-[-0.02em] text-balance motion-safe:animate-rise"
          >
            How good are you
            <!-- nowrap keeps the comma on the same line as "online". -->
            <span class="whitespace-nowrap"><SwashWord>online</SwashWord>,</span>
            really?
          </h1>

          <p
            class="mt-6 max-w-[36rem] text-lg leading-relaxed text-quiet sm:text-xl motion-safe:animate-rise motion-safe:[animation-delay:160ms]"
          >
            Being online every day isn’t the same as knowing how to spot a scam, check a fact or
            work well with others. DigiBridge checks your digital skills, shows your level, and
            gives you lessons that match it.
          </p>
        </div>

        <div class="mt-8 [grid-area:actions] md:self-center lg:self-start">
          <div
            ref="heroCta"
            class="flex flex-wrap items-center gap-x-2 gap-y-3 motion-safe:animate-rise motion-safe:[animation-delay:240ms]"
          >
            <RouterLink
              :to="{ name: 'sign-in' }"
              class="group inline-flex min-h-13 items-center gap-2 rounded-control bg-evergreen px-7 text-lg font-semibold text-white shadow-[0_10px_24px_-10px_rgb(30_91_68/0.7)] transition-colors hover:bg-evergreen-hover"
            >
              Get started
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                class="size-5 fill-none stroke-current stroke-2 transition-transform group-hover:translate-x-0.5"
              >
                <path d="M4 10h12m-5-5 5 5-5 5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </RouterLink>
            <RouterLink
              :to="{ hash: '#how' }"
              class="inline-flex min-h-13 items-center px-4 font-semibold text-evergreen underline-offset-4 hover:underline"
            >
              How it works
            </RouterLink>
          </div>

          <!-- Google sends users back here, so a failed /me after sign-in shows up on this page. -->
          <p
            v-if="session.error"
            role="alert"
            class="mt-6 max-w-[36rem] rounded-control bg-error-soft px-4 py-3 text-error"
          >
            {{ session.error }}
          </p>

          <dl
            class="mt-10 flex max-w-md divide-x divide-line-strong/25 motion-safe:animate-rise motion-safe:[animation-delay:320ms]"
          >
            <div
              v-for="(fact, i) in FACTS"
              :key="fact.label"
              class="flex flex-1 flex-col-reverse px-4 first:pl-0 last:pr-0 sm:px-6"
            >
              <dt class="text-sm text-quiet">{{ fact.label }}</dt>
              <dd class="font-display text-3xl font-bold tabular-nums sm:text-4xl">
                <span aria-hidden="true">{{ factsShown[i] }}</span>
                <span class="sr-only">{{ fact.value }}</span>
              </dd>
            </div>
          </dl>
        </div>

        <div
          class="mt-12 w-full max-w-md [grid-area:card] motion-safe:animate-rise motion-safe:[animation-delay:280ms] md:mt-8 lg:mt-0 lg:self-start"
        >
          <SampleQuestion />
        </div>
      </div>

      <BridgeArt />
    </section>

    <!-- What it checks: one slide per area. -->
    <section id="areas" aria-labelledby="areas-title" class="bg-ink text-white">
      <div class="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div class="grid gap-6 lg:grid-cols-2 lg:items-end lg:gap-16">
          <div>
            <SectionEyebrow class="text-level-2">What it checks</SectionEyebrow>
            <h2
              id="areas-title"
              class="mt-4 text-4xl leading-[1.05] font-bold tracking-[-0.025em] text-balance sm:text-5xl"
            >
              <span v-reveal="80" class="block">{{ AREA_CODES.length }} areas.</span>
              <span v-reveal="180" class="block">{{ ITEMS_PER_AREA }} questions each.</span>
            </h2>
          </div>
          <p v-reveal="260" class="max-w-xl text-lg leading-relaxed text-white/70">
            The areas come from DigComp 2.2, the European framework for digital skills. Many
            questions show a real-looking situation, like a text, a post or a group chat, and ask
            what you would do.
          </p>
        </div>

        <AreaSlides v-reveal class="mt-14 sm:mt-20" labelledby="areas-title" />
      </div>
    </section>

    <HowItWorks />

    <!-- Results: try the real scoring. -->
    <section id="results" aria-labelledby="results-title" class="bg-surface">
      <div class="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div class="grid gap-6 lg:grid-cols-2 lg:items-end lg:gap-16">
          <div>
            <SectionEyebrow class="text-evergreen">Your results</SectionEyebrow>
            <h2
              id="results-title"
              v-reveal="100"
              class="mt-4 text-4xl leading-[1.05] font-bold tracking-[-0.025em] text-balance sm:text-5xl"
            >
              See your level, and what to learn next.
            </h2>
          </div>
          <p v-reveal="200" class="max-w-xl text-lg leading-relaxed text-quiet">
            Each area is scored out of {{ AREA_MAX_POINTS }} points. Your score sets one of
            {{ LEVELS.length }} levels, and your level picks your lessons. You get this for all
            {{ AREA_CODES.length }} areas, plus an overall level.
          </p>
        </div>

        <LevelExplorer v-reveal class="mt-10 sm:mt-14" />
      </div>
    </section>

    <div ref="closing">
      <div class="bg-evergreen text-white">
        <div
          class="mx-auto grid max-w-7xl gap-14 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-2 lg:gap-20 lg:px-8"
        >
          <section id="privacy" aria-labelledby="privacy-title">
            <SectionEyebrow class="text-level-1">Your privacy</SectionEyebrow>
            <h2
              id="privacy-title"
              v-reveal="100"
              class="mt-4 text-4xl leading-[1.05] font-bold tracking-[-0.025em] sm:text-5xl"
            >
              Your answers stay private.
            </h2>
            <ul class="mt-10 space-y-6">
              <li
                v-for="(item, i) in PRIVACY"
                :key="item.icon"
                v-reveal:left="200 + i * 120"
                class="flex gap-4"
              >
                <span
                  class="grid size-11 shrink-0 place-items-center rounded-full bg-white/10"
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 24 24"
                    class="size-5 fill-none stroke-marigold stroke-2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <template v-if="item.icon === 'lock'">
                      <rect x="5" y="11" width="14" height="9" rx="2" />
                      <path class="shackle" d="M8 11V8a4 4 0 0 1 8 0v3" />
                    </template>
                    <template v-else-if="item.icon === 'hide'">
                      <path class="draw" pathLength="1" d="M3 3l18 18" />
                      <path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c5 0 8.5 4 9.5 6a14 14 0 0 1-2.2 2.9" />
                      <path
                        d="M6.6 6.6C4.6 7.9 3.2 9.8 2.5 12c1 2 4.5 6 9.5 6 1.6 0 3.1-.4 4.4-1"
                      />
                      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                    </template>
                    <template v-else-if="item.icon === 'notice'">
                      <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
                      <path d="M14 3v5h5" />
                      <path class="draw" pathLength="1" d="M9 14.5l2 2 4-4.5" />
                    </template>
                    <g v-else class="swing">
                      <rect x="4" y="5" width="16" height="15" rx="2" />
                      <path d="M8 3v4M16 3v4M4 10h16" />
                    </g>
                  </svg>
                </span>
                <p class="pt-2.5 leading-relaxed text-white/85">{{ item.text }}</p>
              </li>
            </ul>
            <RouterLink
              :to="{ name: 'privacy' }"
              class="group mt-8 inline-flex min-h-11 items-center gap-2 font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
            >
              Read the full privacy notice
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                class="size-5 fill-none stroke-current stroke-2 transition-transform group-hover:translate-x-0.5"
              >
                <path d="M4 10h12m-5-5 5 5-5 5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </RouterLink>
          </section>

          <section
            v-reveal:scale="150"
            aria-labelledby="ready-title"
            class="flex flex-col justify-center rounded-[1.25rem] bg-white/[0.06] p-6 ring-1 ring-white/15 sm:p-10 lg:p-12"
          >
            <h2
              id="ready-title"
              class="text-4xl leading-[1.05] font-bold tracking-[-0.025em] sm:text-5xl"
            >
              Ready when you are.
            </h2>
            <p class="mt-4 text-lg leading-relaxed text-white/80">
              Set aside {{ ATTEMPT_DURATION_MINUTES }} minutes somewhere quiet. Once you start, the
              timer keeps running, and you get one try.
            </p>
            <RouterLink
              :to="{ name: 'sign-in' }"
              class="group mt-8 inline-flex min-h-13 w-fit items-center gap-2 rounded-control bg-white px-7 text-lg font-semibold text-evergreen transition-colors hover:bg-evergreen-soft"
            >
              Get started
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                class="nudge size-5 fill-none stroke-current stroke-2 transition-transform group-hover:translate-x-0.5"
              >
                <path d="M4 10h12m-5-5 5 5-5 5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </RouterLink>
            <p class="mt-4 text-sm text-white/70">You’ll sign in with your Google account.</p>
          </section>
        </div>
      </div>

      <SiteFooter />
    </div>

    <!-- Phones only: keeps Get started in reach between the hero and the closing section. -->
    <Transition
      enter-from-class="translate-y-full"
      enter-active-class="transition-transform duration-300 ease-out motion-reduce:transition-none"
      leave-active-class="transition-transform duration-200 ease-in motion-reduce:transition-none"
      leave-to-class="translate-y-full"
    >
      <div
        v-if="showDock"
        class="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_-15px_rgb(18_36_28/0.3)] sm:hidden"
      >
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm leading-tight">
            <span class="block font-semibold">{{ ITEMS_PER_ATTEMPT }} questions</span>
            <span class="text-quiet">{{ ATTEMPT_DURATION_MINUTES }} minutes, one try</span>
          </p>
          <RouterLink
            :to="{ name: 'sign-in' }"
            class="inline-flex min-h-11 items-center rounded-control bg-evergreen px-5 font-semibold text-white"
          >
            Get started
          </RouterLink>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.hero-grid {
  grid-template-areas: 'intro' 'actions' 'card';
}

@media (width >= 48rem) {
  .hero-grid {
    grid-template-areas: 'intro intro' 'actions card';
  }
}

@media (width >= 64rem) {
  .hero-grid {
    grid-template-areas: 'intro card' 'actions card';
  }
}

@media (prefers-reduced-motion: no-preference) {
  /* Privacy icons act out their point once their line has slid in. */
  [data-revealed] .shackle {
    animation: shackle 0.7s var(--ease-glide) calc(var(--reveal-delay, 0ms) + 0.35s) both;
  }

  [data-revealed] .draw {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: draw 0.6s ease-out calc(var(--reveal-delay, 0ms) + 0.4s) forwards;
  }

  [data-revealed] .swing {
    transform-box: fill-box;
    transform-origin: top;
    animation: swing 0.9s ease-out calc(var(--reveal-delay, 0ms) + 0.35s) both;
  }

  /* The closing button's arrow nudges now and then, and holds still on hover. */
  .nudge {
    animation: nudge 2.6s ease-in-out 1.5s infinite;
  }

  .group:hover .nudge {
    animation: none;
  }
}

@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes shackle {
  0% {
    translate: 0 -3px;
  }
  60% {
    translate: 0 0.5px;
  }
}

@keyframes swing {
  0% {
    rotate: -14deg;
  }
  40% {
    rotate: 8deg;
  }
  70% {
    rotate: -3deg;
  }
}

@keyframes nudge {
  0%,
  70%,
  100% {
    translate: 0;
  }
  80% {
    translate: 0.25rem;
  }
  90% {
    translate: 0;
  }
}
</style>
