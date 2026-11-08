<script setup lang="ts">
import {
  AREA_CODES,
  AREA_LABELS,
  AREA_MAX_POINTS,
  ATTEMPT_DURATION_MINUTES,
  DEVICE_LABELS,
  INTERNET_ACCESS_LABELS,
  ITEMS_PER_ATTEMPT,
  LESSON_TIER_LABELS,
  LESSON_TIERS_FOR_LEVEL,
  LEVEL_LABELS,
  levelForPct,
  OVERALL_MAX_POINTS,
  SEX_LABELS,
  type AreaCode,
} from '@digibridge/shared'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { LEVEL_TONE } from '../../lib/levels'
import { prefersReducedMotion } from '../../lib/motion'
import BrandMark from '../BrandMark.vue'

// One app screen for a "How it works" step, drawn small enough for the phone beside the steps.
// Like AreaScene, it plays a short animation while `playing` and shows its last frame otherwise.

export type StepScreenId = 'sign-in' | 'consent' | 'profile' | 'questions' | 'results'

const props = defineProps<{ screen: StepScreenId; playing: boolean }>()

// Questions screen: partway through, with the clock running down while the screen plays.
const QUESTION_NUMBER = 12
const START_SECONDS = ATTEMPT_DURATION_MINUTES * 60 - 7 * 60 - 18
const seconds = ref(START_SECONDS)
let timer: ReturnType<typeof setInterval> | undefined

watch(
  () => props.playing && props.screen === 'questions',
  (ticking) => {
    clearInterval(timer)
    seconds.value = START_SECONDS
    if (ticking && !prefersReducedMotion())
      timer = setInterval(() => (seconds.value = Math.max(seconds.value - 1, 0)), 1000)
  },
  { immediate: true },
)
onBeforeUnmount(() => clearInterval(timer))

const clock = computed(
  () => `${Math.floor(seconds.value / 60)}:${String(seconds.value % 60).padStart(2, '0')}`,
)

// Results screen: a made-up result, scored with the real rules.
const SAMPLE_POINTS: Record<AreaCode, number> = { info_literacy: 15, communication: 11, safety: 8 }
const areaResults = AREA_CODES.map((code) => {
  const pct = (SAMPLE_POINTS[code] / AREA_MAX_POINTS) * 100
  return { code, pct, level: levelForPct(pct) }
})
const overall = levelForPct(
  (Object.values(SAMPLE_POINTS).reduce((sum, n) => sum + n, 0) / OVERALL_MAX_POINTS) * 100,
)
const weakest = areaResults.reduce((low, r) => (r.pct < low.pct ? r : low))
const firstLesson = LESSON_TIERS_FOR_LEVEL[weakest.level][0]

const CHOICES = [
  'Forward it, just to be safe',
  'Don’t forward it. It’s a hoax.',
  'Reply with your password',
  'Post it on your page',
]
const PICKED = 1
</script>

<template>
  <div
    aria-hidden="true"
    class="flex h-full flex-col p-4 text-ink select-none"
    :class="playing && 'is-playing'"
  >
    <!-- 1. Sign in with Google -->
    <template v-if="screen === 'sign-in'">
      <div class="flex flex-1 flex-col items-center justify-center text-center">
        <span class="logo relative grid size-16 place-items-center rounded-2xl bg-evergreen-soft">
          <BrandMark class="size-10" />
        </span>
        <p class="mt-4 font-display text-xl font-bold">DigiBridge</p>
        <p class="mt-1 text-xs text-quiet">Check your digital skills</p>
      </div>
      <div class="relative">
        <p
          class="welcome absolute inset-x-0 -top-12 flex items-center justify-center gap-1.5 rounded-full bg-evergreen-soft px-3 py-1.5 text-[0.6875rem] font-semibold text-evergreen"
        >
          <svg viewBox="0 0 16 16" class="size-3 fill-none stroke-current stroke-[2.5]">
            <path d="M3.5 8.5l3 3 6-7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          Your account is ready
        </p>
        <span
          class="tap relative flex h-11 items-center justify-center gap-2 overflow-hidden rounded-control border border-line-strong text-sm font-semibold"
        >
          <span
            class="grid size-5 place-items-center rounded-full border border-line-strong text-[0.625rem] font-bold"
          >
            G
          </span>
          Continue with Google
          <span class="ripple absolute top-1/2 left-1/2 size-24 rounded-full bg-evergreen/15" />
        </span>
      </div>
    </template>

    <!-- 2. Agree to the privacy notice -->
    <template v-else-if="screen === 'consent'">
      <p class="font-display text-base font-bold">Privacy notice</p>
      <p class="mt-1 text-[0.6875rem] text-quiet">Please read before you start.</p>
      <div class="mt-4 space-y-2">
        <span
          v-for="(w, k) in ['100%', '92%', '96%', '70%', '88%', '94%', '60%']"
          :key="k"
          class="text-line block h-1.5 origin-left rounded-full bg-track"
          :style="{ width: w, '--k': k }"
        />
      </div>
      <div class="note mt-4 rounded-card bg-marigold-soft p-3 text-[0.6875rem] leading-snug">
        <span class="font-bold">What we collect:</span> your answers and your profile, nothing more.
      </div>
      <div class="mt-auto grid grid-cols-2 gap-2 pt-4 text-xs font-semibold">
        <span
          class="flex h-10 items-center justify-center rounded-control border border-line-strong"
        >
          Decline
        </span>
        <span
          class="agree relative flex h-10 items-center justify-center gap-1.5 overflow-hidden rounded-control bg-evergreen text-white"
        >
          <svg viewBox="0 0 16 16" class="check size-3.5 fill-none stroke-current stroke-[2.5]">
            <path d="M3.5 8.5l3 3 6-7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          I agree
          <span class="ripple absolute top-1/2 left-1/2 size-20 rounded-full bg-white/25" />
        </span>
      </div>
    </template>

    <!-- 3. Fill in your profile -->
    <template v-else-if="screen === 'profile'">
      <p class="font-display text-base font-bold">Your profile</p>
      <p class="mt-1 text-[0.6875rem] text-quiet">This helps us see who needs more help.</p>
      <div class="mt-4 grid grid-cols-2 gap-2">
        <div v-for="(f, k) in ['Age', 'Sex']" :key="f" class="field" :style="{ '--k': k }">
          <p class="text-[0.625rem] font-semibold text-quiet">{{ f }}</p>
          <p
            class="mt-1 flex h-9 items-center rounded-control border border-line-strong px-2.5 text-xs font-semibold"
          >
            <span class="typed">{{ k === 0 ? '19' : SEX_LABELS.female }}</span>
          </p>
        </div>
      </div>
      <p class="mt-4 text-[0.625rem] font-semibold text-quiet">Devices you use</p>
      <div class="mt-1.5 flex flex-wrap gap-1.5">
        <span
          v-for="(device, k) in ['smartphone', 'laptop', 'tablet'] as const"
          :key="device"
          class="chip rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold"
          :class="
            k < 2
              ? 'is-on border-evergreen bg-evergreen-soft text-evergreen'
              : 'border-line text-quiet'
          "
          :style="{ '--k': k }"
        >
          {{ DEVICE_LABELS[device] }}
        </span>
      </div>
      <p class="mt-4 text-[0.625rem] font-semibold text-quiet">How you get online</p>
      <div class="mt-1.5 flex flex-wrap gap-1.5">
        <span
          v-for="(access, k) in ['mobile_data', 'home_wifi'] as const"
          :key="access"
          class="chip rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold"
          :class="
            k === 0
              ? 'is-on border-evergreen bg-evergreen-soft text-evergreen'
              : 'border-line text-quiet'
          "
          :style="{ '--k': k + 3 }"
        >
          {{ INTERNET_ACCESS_LABELS[access] }}
        </span>
      </div>
      <span
        class="mt-auto flex h-10 items-center justify-center rounded-control bg-evergreen text-xs font-semibold text-white"
      >
        Save and continue
      </span>
    </template>

    <!-- 4. Answer the questions -->
    <template v-else-if="screen === 'questions'">
      <div class="flex items-center justify-between text-[0.6875rem] font-semibold">
        <span>Question {{ QUESTION_NUMBER }} of {{ ITEMS_PER_ATTEMPT }}</span>
        <span
          class="flex items-center gap-1.5 rounded-full bg-marigold-soft px-2 py-1 tabular-nums"
        >
          <span class="tick size-1.5 rounded-full bg-marigold" />
          {{ clock }}
        </span>
      </div>
      <div class="mt-2 flex gap-[3px]">
        <span
          v-for="n in ITEMS_PER_ATTEMPT"
          :key="n"
          class="h-1.5 flex-1 rounded-[1px]"
          :class="
            n < QUESTION_NUMBER
              ? 'bg-evergreen'
              : n === QUESTION_NUMBER
                ? 'current bg-evergreen'
                : 'bg-track'
          "
        />
      </div>
      <div class="mt-4 rounded-card bg-mist-soft p-3">
        <p class="text-[0.625rem] font-semibold text-quiet">Sent to your group chat</p>
        <p class="mt-1.5 rounded-xl rounded-tl-sm bg-surface px-2.5 py-1.5 text-[0.6875rem]">
          Forward this to 10 friends or your account gets deleted tonight!!
        </p>
      </div>
      <p class="mt-3 text-xs leading-snug font-semibold">What should you do?</p>
      <ul class="mt-2 space-y-1.5">
        <li
          v-for="(c, k) in CHOICES"
          :key="c"
          class="choice flex h-8 items-center gap-2 rounded-control border px-2 text-[0.6875rem]"
          :class="k === PICKED ? 'is-picked border-evergreen bg-evergreen-soft' : 'border-line'"
        >
          <span
            class="grid size-4 shrink-0 place-items-center rounded-full border text-[0.5rem] font-bold"
            :class="
              k === PICKED ? 'border-evergreen bg-evergreen text-white' : 'border-line-strong'
            "
          >
            {{ String.fromCharCode(65 + k) }}
          </span>
          {{ c }}
        </li>
      </ul>
      <div class="mt-auto flex justify-between gap-2 pt-3 text-[0.6875rem] font-semibold">
        <span class="flex h-8 items-center rounded-control border border-line px-3">Back</span>
        <span class="flex h-8 items-center rounded-control bg-evergreen px-3 text-white">
          Next
        </span>
      </div>
    </template>

    <!-- 5. See your level and lessons -->
    <template v-else>
      <p class="text-[0.6875rem] font-semibold text-quiet">Your overall level</p>
      <p class="mt-1.5">
        <span
          class="stamp inline-flex rounded-full px-3.5 py-1 font-display text-lg font-bold"
          :class="LEVEL_TONE[overall]"
        >
          {{ LEVEL_LABELS[overall] }}
        </span>
      </p>
      <ul class="mt-4 space-y-3">
        <li v-for="(r, k) in areaResults" :key="r.code">
          <p class="flex items-center justify-between gap-2 text-[0.6875rem]">
            <span class="truncate font-semibold">{{ AREA_LABELS[r.code] }}</span>
            <span class="shrink-0 text-quiet">{{ LEVEL_LABELS[r.level] }}</span>
          </p>
          <span class="mt-1 block h-2 overflow-hidden rounded-full bg-track">
            <span
              class="bar block h-full origin-left rounded-full"
              :class="LEVEL_TONE[r.level]"
              :style="{ width: `${r.pct}%`, '--k': k }"
            />
          </span>
        </li>
      </ul>
      <div class="lesson mt-auto rounded-card border border-line p-3">
        <p class="text-[0.625rem] font-semibold text-marigold-text">Start here</p>
        <p class="mt-0.5 text-xs font-bold">{{ AREA_LABELS[weakest.code] }}</p>
        <p class="text-[0.6875rem] text-quiet">{{ LESSON_TIER_LABELS[firstLesson] }} lesson</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  /* Sign in */
  .is-playing .logo {
    animation: pop 0.6s var(--ease-glide) 0.1s both;
  }

  .is-playing .tap {
    animation: press 0.3s ease-in-out 0.9s;
  }

  .is-playing .welcome {
    animation: drop-in 0.5s var(--ease-glide) 1.3s both;
  }

  /* Consent */
  .is-playing .text-line {
    animation: grow-x 0.5s var(--ease-glide) both;
    animation-delay: calc(0.15s + var(--k) * 90ms);
  }

  .is-playing .note {
    animation: rise-in 0.5s var(--ease-glide) 0.9s both;
  }

  .is-playing .agree {
    animation: press 0.3s ease-in-out 1.6s;
  }

  .is-playing .check {
    animation: pop 0.4s var(--ease-glide) 1.75s both;
  }

  /* Profile */
  .is-playing .field {
    animation: rise-in 0.5s var(--ease-glide) both;
    animation-delay: calc(0.15s + var(--k) * 120ms);
  }

  .is-playing .field .typed {
    animation: type 0.6s steps(10, end) both;
    animation-delay: calc(0.5s + var(--k) * 400ms);
  }

  .is-playing .chip.is-on {
    animation: chip-on 0.35s ease-out both;
    animation-delay: calc(1.3s + var(--k) * 200ms);
  }

  /* Questions */
  .is-playing .tick {
    animation: blink 1s step-end infinite;
  }

  .is-playing .current {
    animation: fill-in 0.4s ease-out 1.4s both;
  }

  .is-playing .choice {
    animation: rise-in 0.4s var(--ease-glide) both;
  }

  .is-playing .choice:nth-child(2) {
    animation-delay: 0.08s;
  }

  .is-playing .choice:nth-child(3) {
    animation-delay: 0.16s;
  }

  .is-playing .choice:nth-child(4) {
    animation-delay: 0.24s;
  }

  .is-playing .choice.is-picked {
    animation:
      rise-in 0.4s var(--ease-glide) 0.08s both,
      pick 0.35s ease-out 1.1s both;
  }

  /* Results */
  .is-playing .bar {
    animation: grow-x 0.9s var(--ease-glide) both;
    animation-delay: calc(0.2s + var(--k) * 180ms);
  }

  .is-playing .stamp {
    animation: stamp 0.5s var(--ease-glide) 1s both;
  }

  .is-playing .lesson {
    animation: rise-in 0.5s var(--ease-glide) 1.4s both;
  }
}

.ripple {
  translate: -50% -50%;
  scale: 0;
}

@media (prefers-reduced-motion: no-preference) {
  .is-playing .tap .ripple {
    animation: ripple 0.7s ease-out 0.9s;
  }

  .is-playing .agree .ripple {
    animation: ripple 0.7s ease-out 1.6s;
  }
}

@keyframes pop {
  from {
    opacity: 0;
    scale: 0.5;
  }
}

@keyframes press {
  50% {
    scale: 0.96;
  }
}

@keyframes ripple {
  from {
    scale: 0;
    opacity: 1;
  }
  to {
    scale: 2;
    opacity: 0;
  }
}

@keyframes drop-in {
  from {
    opacity: 0;
    translate: 0 -0.75rem;
  }
}

@keyframes rise-in {
  from {
    opacity: 0;
    translate: 0 0.5rem;
  }
}

@keyframes grow-x {
  from {
    scale: 0 1;
  }
}

@keyframes type {
  from {
    clip-path: inset(0 100% 0 0);
  }
  to {
    clip-path: inset(0);
  }
}

@keyframes chip-on {
  from {
    border-color: var(--color-line);
    background-color: transparent;
    color: var(--color-quiet);
  }
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

@keyframes fill-in {
  from {
    background-color: var(--color-track);
  }
}

@keyframes pick {
  from {
    border-color: var(--color-line);
    background-color: transparent;
  }
}

@keyframes stamp {
  from {
    opacity: 0;
    scale: 1.6;
    rotate: -8deg;
  }
}
</style>
