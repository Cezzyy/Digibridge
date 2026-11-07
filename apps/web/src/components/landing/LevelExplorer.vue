<script setup lang="ts">
import {
  AREA_MAX_POINTS,
  DIFFICULTIES,
  ITEMS_PER_DIFFICULTY,
  LESSON_TIER_LABELS,
  LESSON_TIERS_FOR_LEVEL,
  LEVEL_LABELS,
  LEVELS,
  levelForPct,
  POINTS_PER_DIFFICULTY,
  type Difficulty,
} from '@digibridge/shared'
import { computed, onBeforeUnmount, onMounted, ref, useId, useTemplateRef, watch } from 'vue'
import { LEVEL_BANDS, LEVEL_TONE } from '../../lib/levels'
import { onFirstView, prefersReducedMotion, tween } from '../../lib/motion'

// "Try a score" on the landing page: drag across one area's points and see the level and
// lessons it gives, using the real scoring rules from @digibridge/shared.

const id = useId()

// Starts at the PRD's example: 4 basic, 2 intermediate and 1 advanced right is 11 of 18.
const EXAMPLE_POINTS = 11
const points = ref(EXAMPLE_POINTS)
const pct = computed(() => (points.value / AREA_MAX_POINTS) * 100)
const level = computed(() => levelForPct(pct.value))
const tiers = computed(() => LESSON_TIERS_FOR_LEVEL[level.value])

// The first time it scrolls into view, the marker sweeps up from 0 to the example, so the level
// and lessons change as it crosses each level. Touching the slider stops the sweep.
const root = useTemplateRef<HTMLElement>('root')
let stopWatching: (() => void) | undefined
let cancelSweep: (() => void) | undefined

onMounted(() => {
  if (!root.value || prefersReducedMotion()) return
  points.value = 0
  stopWatching = onFirstView(root.value, () => {
    cancelSweep = tween(1800, (t) => (points.value = Math.round(t * EXAMPLE_POINTS)), 350)
  })
})

function stopSweep() {
  cancelSweep?.()
  cancelSweep = undefined
}

onBeforeUnmount(() => {
  stopWatching?.()
  stopSweep()
})

// The score and the level roll up or down, the way the score moved. Each new, higher level
// sets off a small burst.
const rising = ref(true)
const bursts = ref(0)
watch(points, (now, before) => (rising.value = now >= before))
watch(level, (now, before) => {
  if (LEVELS.indexOf(now) > LEVELS.indexOf(before)) bursts.value++
})
const rollIn = computed(() => (rising.value ? 'translate-y-full' : '-translate-y-full'))
const rollOut = computed(() => (rising.value ? '-translate-y-full' : 'translate-y-full'))

const band = computed(() => LEVEL_BANDS.find((b) => b.level === level.value))
const bandRange = computed(() => {
  const b = band.value
  if (!b) return ''
  if (b.from === 0) return `Below ${b.to}%`
  if (b.to === 100) return `${b.from}% and up`
  return `${b.from}% to ${b.to - 1}%`
})

/** One way to earn `total` points: as many basic items as possible, then harder ones. */
function itemsRight(total: number): Record<Difficulty, number> {
  const p = POINTS_PER_DIFFICULTY
  for (let basic = ITEMS_PER_DIFFICULTY.basic; basic >= 0; basic--) {
    for (let mid = ITEMS_PER_DIFFICULTY.intermediate; mid >= 0; mid--) {
      const rest = total - basic * p.basic - mid * p.intermediate
      const advanced = rest / p.advanced
      if (Number.isInteger(advanced) && advanced >= 0 && advanced <= ITEMS_PER_DIFFICULTY.advanced)
        return { basic, intermediate: mid, advanced }
    }
  }
  return { basic: 0, intermediate: 0, advanced: 0 }
}

/** The area's 10 items as bars as tall as their points, filled when answered right. */
const items = computed(() => {
  const right = itemsRight(points.value)
  return DIFFICULTIES.map((d) => ({
    difficulty: d,
    points: POINTS_PER_DIFFICULTY[d],
    bars: Array.from({ length: ITEMS_PER_DIFFICULTY[d] }, (_, k) => k < right[d]),
    right: right[d],
  }))
})

const valueText = computed(
  () =>
    `${points.value} of ${AREA_MAX_POINTS} points, ${Math.round(pct.value)}%, ${LEVEL_LABELS[level.value]}`,
)
</script>

<template>
  <div ref="root">
    <div class="group relative select-none">
      <!-- Percentage bubble; it slides less than the marker so it never leaves the band. -->
      <div class="relative h-11" aria-hidden="true">
        <div
          class="absolute bottom-2 transition-[left] duration-300 ease-out motion-reduce:transition-none"
          :style="{ left: `${pct}%` }"
        >
          <div
            class="rounded-full bg-ink px-2.5 py-1 text-sm font-bold whitespace-nowrap text-white tabular-nums"
            :style="{ transform: `translateX(-${pct}%)` }"
          >
            {{ Math.round(pct) }}%
          </div>
        </div>
      </div>

      <div class="relative">
        <div class="flex h-14 overflow-hidden rounded-card sm:h-16" aria-hidden="true">
          <div
            v-for="b in LEVEL_BANDS"
            :key="b.level"
            class="flex min-w-0 items-center px-2 transition-opacity duration-300 sm:px-4"
            :class="[LEVEL_TONE[b.level], b.level === level ? 'opacity-100' : 'opacity-35']"
            :style="{ width: `${b.to - b.from}%` }"
          >
            <span class="hidden truncate text-sm font-semibold sm:inline">
              {{ LEVEL_LABELS[b.level] }}
            </span>
          </div>
        </div>

        <input
          :id="`${id}-range`"
          v-model.number="points"
          type="range"
          min="0"
          :max="AREA_MAX_POINTS"
          step="1"
          :aria-valuetext="valueText"
          class="level-range absolute inset-0 h-full w-full cursor-grab appearance-none bg-transparent opacity-0 active:cursor-grabbing"
          @pointerdown="stopSweep"
          @keydown="stopSweep"
        />

        <div
          class="pointer-events-none absolute -inset-y-1.5 transition-[left] duration-300 ease-out motion-reduce:transition-none"
          :style="{ left: `${pct}%` }"
          aria-hidden="true"
        >
          <div class="absolute inset-y-0 left-0 w-1 -translate-x-1/2 rounded-full bg-ink" />
          <div
            class="absolute top-1/2 left-0 size-7 -translate-1/2 rounded-full border-4 border-ink bg-marigold shadow-[0_2px_6px_rgb(18_36_28/0.35)] transition-shadow group-has-[input:focus-visible]:ring-4 group-has-[input:focus-visible]:ring-evergreen/40"
          />
        </div>
      </div>

      <div
        class="relative mt-2 h-5 text-xs font-semibold text-quiet tabular-nums"
        aria-hidden="true"
      >
        <span
          v-for="mark in [...LEVEL_BANDS.map((b) => b.from), 100]"
          :key="mark"
          class="absolute"
          :style="{ left: `${mark}%`, transform: `translateX(-${mark}%)` }"
        >
          {{ mark }}%
        </span>
      </div>
    </div>

    <label :for="`${id}-range`" class="mt-3 block text-sm text-quiet">
      Drag the marker (or use the arrow keys) to try a score in one area.
    </label>

    <dl
      class="mt-8 grid divide-y divide-line overflow-hidden rounded-card border border-line bg-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0"
    >
      <div class="p-5 sm:p-6">
        <dt class="text-sm font-semibold text-quiet">Score in this area</dt>
        <dd class="mt-1 flex items-baseline gap-2">
          <span class="inline-grid overflow-hidden font-display text-4xl font-bold tabular-nums">
            <Transition
              :enter-from-class="`${rollIn} opacity-0`"
              enter-active-class="transition duration-200 ease-out motion-reduce:transition-none"
              leave-active-class="transition duration-150 ease-in motion-reduce:transition-none"
              :leave-to-class="`${rollOut} opacity-0`"
            >
              <span :key="points" class="col-start-1 row-start-1">{{ points }}</span>
            </Transition>
          </span>
          <span class="text-quiet">of {{ AREA_MAX_POINTS }} points</span>
        </dd>
        <dd class="mt-4">
          <div class="flex items-end gap-3" aria-hidden="true">
            <div v-for="(group, g) in items" :key="group.difficulty">
              <div class="flex items-end gap-1">
                <span
                  v-for="(isRight, k) in group.bars"
                  :key="k"
                  class="w-3 origin-bottom rounded-sm transition-[background-color,scale] duration-300 ease-glide motion-reduce:transition-none"
                  :class="isRight ? 'bg-evergreen' : 'scale-y-[0.8] bg-track'"
                  :style="{
                    height: `${group.points * 0.75}rem`,
                    transitionDelay: `${(g * 4 + k) * 25}ms`,
                  }"
                />
              </div>
              <p class="mt-1.5 text-[0.6875rem] font-semibold text-quiet">
                {{ group.points }} {{ group.points === 1 ? 'pt' : 'pts' }}
              </p>
            </div>
          </div>
          <p class="sr-only">
            Right answers:
            {{ items.map((g) => `${g.right} ${g.difficulty}`).join(', ') }}.
          </p>
          <p class="mt-2 text-xs text-quiet">Harder questions are worth more.</p>
        </dd>
      </div>

      <div class="p-5 sm:p-6">
        <dt class="text-sm font-semibold text-quiet">Your level</dt>
        <dd class="relative mt-3 inline-grid">
          <span
            v-if="bursts"
            :key="bursts"
            class="burst pointer-events-none absolute top-1/2 left-1/2"
            aria-hidden="true"
          >
            <span
              v-for="k in 10"
              :key="k"
              class="absolute -top-1 -left-1 size-2 rounded-full"
              :class="k % 2 ? 'bg-marigold' : 'bg-level-2'"
              :style="{ '--angle': `${k * 36}deg` }"
            />
          </span>
          <span class="inline-grid overflow-hidden rounded-full">
            <Transition
              :enter-from-class="rollIn"
              enter-active-class="transition duration-400 ease-glide motion-reduce:transition-none"
              leave-active-class="transition duration-300 ease-glide motion-reduce:transition-none"
              :leave-to-class="rollOut"
            >
              <span
                :key="level"
                class="col-start-1 row-start-1 inline-flex w-fit rounded-full px-4 py-1.5 font-display text-2xl font-bold"
                :class="LEVEL_TONE[level]"
              >
                {{ LEVEL_LABELS[level] }}
              </span>
            </Transition>
          </span>
        </dd>
        <dd class="mt-3 text-sm text-quiet">{{ bandRange }} of the points</dd>
      </div>

      <div class="p-5 sm:p-6">
        <dt class="text-sm font-semibold text-quiet">Lessons for you</dt>
        <dd class="mt-3">
          <TransitionGroup
            tag="ol"
            class="grid gap-2"
            enter-from-class="translate-x-6 opacity-0"
            enter-active-class="transition duration-500 ease-glide motion-reduce:transition-none"
            leave-active-class="hidden"
            move-class="transition duration-500 ease-glide motion-reduce:transition-none"
          >
            <li
              v-for="(tier, i) in tiers"
              :key="tier"
              class="flex min-h-11 items-center justify-between gap-3 rounded-control border border-line bg-surface px-3"
            >
              <span class="font-semibold">{{ LESSON_TIER_LABELS[tier] }} lesson</span>
              <span
                class="text-xs font-semibold"
                :class="i === 0 ? 'text-evergreen' : 'text-marigold-text'"
              >
                {{ i === 0 ? 'Start here' : 'Next step' }}
              </span>
            </li>
          </TransitionGroup>
        </dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.burst > span {
  opacity: 0;
}

@media (prefers-reduced-motion: no-preference) {
  .burst > span {
    animation: burst 0.8s var(--ease-glide) both;
  }
}

@keyframes burst {
  from {
    opacity: 1;
    transform: rotate(var(--angle)) translateX(1.5rem) scale(1);
  }
  to {
    opacity: 0;
    transform: rotate(var(--angle)) translateX(4.5rem) scale(0.3);
  }
}

/* The range input is invisible; a thin thumb keeps its value in line with the drawn marker. */
.level-range::-webkit-slider-thumb {
  appearance: none;
  width: 2px;
  height: 100%;
}

.level-range::-moz-range-thumb {
  width: 2px;
  height: 100%;
  border: 0;
}
</style>
