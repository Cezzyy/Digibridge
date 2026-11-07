<script setup lang="ts">
import { ATTEMPT_DURATION_MINUTES, ITEMS_PER_ATTEMPT } from '@digibridge/shared'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { vReveal } from '../../lib/motion'
import BrandMark from '../BrandMark.vue'
import SectionEyebrow from './SectionEyebrow.vue'
import StepScreen, { type StepScreenId } from './StepScreen.vue'

// "How it works": the steps as a route that fills in as you scroll. The step that has reached
// the middle of the screen is the current one, and its app screen plays: in the phone that
// stays beside the steps on desktops, or under the step itself on phones.

const STEPS: { screen: StepScreenId; title: string; body: string }[] = [
  {
    screen: 'sign-in',
    title: 'Sign in with Google',
    body: 'Your first sign-in makes your DigiBridge account.',
  },
  {
    screen: 'consent',
    title: 'Agree to the privacy notice',
    body: 'It explains what we collect and why, under the Data Privacy Act of 2012.',
  },
  {
    screen: 'profile',
    title: 'Fill in your profile',
    body: 'Your course and year level, and the devices and internet you use.',
  },
  {
    screen: 'questions',
    title: `Answer ${ITEMS_PER_ATTEMPT} questions`,
    body: `You have ${ATTEMPT_DURATION_MINUTES} minutes. Go back and change answers anytime before you submit.`,
  },
  {
    screen: 'results',
    title: 'See your level and lessons',
    body: 'Your results show up as soon as you submit.',
  },
]
const LAST = STEPS.length - 1

const active = ref(0)
/** How far the route between step i and step i + 1 is drawn, from 0 to 1. */
const fill = ref(STEPS.slice(1).map(() => 0))

const dots: HTMLElement[] = []
let frame = 0

function measure() {
  frame = 0
  if (dots.length < STEPS.length) return
  const middle = window.innerHeight / 2
  const centers = dots.map((dot) => {
    const box = dot.getBoundingClientRect()
    return box.top + box.height / 2
  })
  active.value = Math.max(
    centers.findLastIndex((center) => center <= middle),
    0,
  )
  fill.value = centers.slice(1).map((next, i) => {
    const from = centers[i] ?? next
    return Math.min(Math.max((middle - from) / (next - from), 0), 1)
  })
}

const onScroll = () => (frame ||= requestAnimationFrame(measure))

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
  measure()
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  cancelAnimationFrame(frame)
})

function dotClass(i: number) {
  if (i > active.value) return 'border-evergreen/30 bg-mist text-evergreen'
  if (i === LAST) return 'border-marigold bg-marigold text-ink'
  return 'border-evergreen bg-evergreen text-white'
}

function screenClass(i: number) {
  if (i === active.value) return 'opacity-100'
  return i < active.value ? '-translate-y-10 scale-95 opacity-0' : 'translate-y-10 opacity-0'
}
</script>

<template>
  <section id="how" aria-labelledby="how-title">
    <div class="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <SectionEyebrow class="text-evergreen">How it works</SectionEyebrow>
      <h2
        id="how-title"
        v-reveal="100"
        class="mt-4 max-w-3xl text-4xl leading-[1.05] font-bold tracking-[-0.025em] text-balance sm:text-5xl"
      >
        From sign-in to your lessons in {{ STEPS.length }} steps.
      </h2>

      <div
        class="mt-14 grid [--phone-h:min(36rem,calc(80svh-var(--spacing-header)))] sm:mt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-16"
      >
        <ol>
          <li
            v-for="(step, i) in STEPS"
            :key="step.title"
            class="relative flex gap-5 pb-14 last:pb-0 lg:min-h-[30svh] lg:pb-0 lg:last:min-h-[calc(var(--phone-h)/2+2rem)]"
          >
            <!-- The route to the next step, drawn as far as you've scrolled. -->
            <span
              v-if="i < LAST"
              aria-hidden="true"
              class="absolute top-12 bottom-2 left-5 w-0.5 -translate-x-1/2 overflow-hidden rounded-full bg-evergreen/15"
            >
              <span
                class="block h-full origin-top bg-evergreen"
                :style="{ transform: `scaleY(${fill[i] ?? 0})` }"
              />
            </span>

            <span
              :ref="(el) => (dots[i] = el as HTMLElement)"
              class="relative grid size-10 shrink-0 place-items-center rounded-full border-2 font-display text-lg font-bold transition-colors duration-500"
              :class="dotClass(i)"
            >
              <span
                v-if="i === active"
                aria-hidden="true"
                class="pulse absolute -inset-0.5 rounded-full border-2"
                :class="i === LAST ? 'border-marigold' : 'border-evergreen'"
              />
              {{ i + 1 }}
            </span>

            <div
              class="min-w-0 flex-1 pt-1.5 md:grid md:grid-cols-[minmax(0,1fr)_17rem] md:gap-x-8 lg:block"
            >
              <div>
                <h3
                  class="text-xl leading-snug font-bold transition-colors duration-500 sm:text-2xl"
                  :class="i === active ? 'text-evergreen' : 'text-ink'"
                >
                  {{ step.title }}
                </h3>
                <p class="mt-1.5 max-w-md leading-relaxed text-quiet sm:text-lg">{{ step.body }}</p>
              </div>

              <!-- Phones and tablets: each step shows its own screen, beside the text on tablets. -->
              <div
                class="mt-6 h-[24rem] max-w-[19rem] overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-[0_30px_50px_-30px_rgb(18_36_28/0.45)] md:mt-0 lg:hidden"
              >
                <StepScreen :screen="step.screen" :playing="active === i" />
              </div>
            </div>
          </li>
        </ol>

        <!-- Desktops: one phone starts beside step 1, then stays in the middle of the screen and
             changes screen as the steps go by. -->
        <div class="relative hidden lg:block" aria-hidden="true">
          <div
            class="sticky top-[calc(var(--spacing-header)+(100svh-var(--spacing-header)-var(--phone-h))/2)] flex justify-center"
          >
            <div class="phone-float relative">
              <div
                class="absolute top-1/2 left-1/2 aspect-square w-[165%] -translate-1/2 rounded-full bg-evergreen-soft"
              />
              <Transition
                enter-from-class="translate-y-8 opacity-0"
                enter-active-class="transition duration-700 ease-glide motion-reduce:transition-none"
                leave-active-class="transition duration-300 ease-in motion-reduce:transition-none"
                leave-to-class="-translate-y-8 opacity-0"
              >
                <span
                  :key="active"
                  class="absolute -top-14 -left-32 font-display text-[10rem] leading-none font-extrabold text-evergreen/10 tabular-nums"
                >
                  {{ String(active + 1).padStart(2, '0') }}
                </span>
              </Transition>

              <div
                class="relative aspect-[9/18.5] h-(--phone-h) rounded-[2.75rem] bg-ink p-2.5 shadow-[0_50px_80px_-40px_rgb(18_36_28/0.6)]"
              >
                <div class="flex h-full flex-col overflow-hidden rounded-[2.25rem] bg-surface">
                  <div
                    class="relative flex items-center justify-between px-6 pt-2.5 pb-1 text-[0.625rem] font-semibold"
                  >
                    <span>9:41</span>
                    <span
                      class="absolute top-2 left-1/2 h-5 w-20 -translate-x-1/2 rounded-full bg-ink"
                    />
                    <span class="flex items-center gap-1">
                      <span class="h-2 w-3 rounded-[2px] bg-ink" />
                      <span class="h-2 w-4 rounded-[2px] border border-ink" />
                    </span>
                  </div>
                  <div
                    class="flex items-center gap-1.5 border-b border-line px-4 py-2.5 font-display text-sm font-bold text-evergreen"
                  >
                    <BrandMark class="size-5" />
                    DigiBridge
                    <span class="ml-auto font-sans text-[0.625rem] font-semibold text-quiet">
                      Step {{ active + 1 }} of {{ STEPS.length }}
                    </span>
                  </div>
                  <div class="relative min-h-0 flex-1">
                    <div
                      v-for="(step, i) in STEPS"
                      :key="step.screen"
                      class="absolute inset-0 transition-[opacity,translate,scale] duration-500 ease-glide motion-reduce:transition-none"
                      :class="screenClass(i)"
                    >
                      <StepScreen :screen="step.screen" :playing="active === i" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .pulse {
    animation: pulse 1.8s ease-out infinite;
  }

  .phone-float {
    animation: float 7s ease-in-out infinite;
  }
}

@keyframes pulse {
  from {
    opacity: 0.8;
    scale: 1;
  }
  to {
    opacity: 0;
    scale: 1.7;
  }
}

@keyframes float {
  50% {
    translate: 0 -0.6rem;
  }
}
</style>
