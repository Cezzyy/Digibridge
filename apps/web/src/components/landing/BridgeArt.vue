<script setup lang="ts">
import { LEVEL_LABELS } from '@digibridge/shared'
import { LEVEL_BANDS, LEVEL_TONE } from '../../lib/levels'

// The landing page's bridge. Its deck is the real level scale, so the 4 parts are as wide as the
// level ranges in LEVEL_CUTOFFS. The SVG stretches to any width (preserveAspectRatio="none");
// non-scaling strokes keep the lines crisp at every size.

const W = 1440
const DECK = 172
const TOWER_TOP = 12
const TOWERS = [320, 1120] as const
const [LEFT, RIGHT] = TOWERS

/** Point on a quadratic curve whose control point sits halfway along x, so x moves evenly. */
const curveY = (t: number, y0: number, yc: number, y1: number) =>
  (1 - t) ** 2 * y0 + 2 * (1 - t) * t * yc + t ** 2 * y1

const SIDE_START = 160
const SIDE_CONTROL = 104
const MAIN_CONTROL = 264

const cable = [
  `M0,${SIDE_START} Q${LEFT / 2},${SIDE_CONTROL} ${LEFT},${TOWER_TOP}`,
  `Q${(LEFT + RIGHT) / 2},${MAIN_CONTROL} ${RIGHT},${TOWER_TOP}`,
  `Q${(RIGHT + W) / 2},${SIDE_CONTROL} ${W},${SIDE_START}`,
].join(' ')

function cableY(x: number): number {
  if (x < LEFT) return curveY(x / LEFT, SIDE_START, SIDE_CONTROL, TOWER_TOP)
  if (x > RIGHT) return curveY((W - x) / (W - RIGHT), SIDE_START, SIDE_CONTROL, TOWER_TOP)
  return curveY((x - LEFT) / (RIGHT - LEFT), TOWER_TOP, MAIN_CONTROL, TOWER_TOP)
}

const STEP = 32
const hangers = Array.from({ length: W / STEP - 1 }, (_, i) => (i + 1) * STEP)
  .filter((x) => !TOWERS.includes(x as (typeof TOWERS)[number]))
  .map((x) => ({ x, y: cableY(x) }))
</script>

<template>
  <div aria-hidden="true" class="pointer-events-none select-none">
    <svg
      :viewBox="`0 0 ${W} ${DECK}`"
      preserveAspectRatio="none"
      class="block h-[clamp(4.5rem,11svh,6rem)] w-full sm:h-[clamp(5rem,15svh,9rem)]"
    >
      <g fill="none" stroke-linecap="round">
        <line
          v-for="(h, i) in hangers"
          :key="h.x"
          :x1="h.x"
          :x2="h.x"
          :y1="h.y"
          :y2="DECK"
          class="bridge-hanger stroke-evergreen/35"
          stroke-width="1.25"
          vector-effect="non-scaling-stroke"
          :style="{ '--i': i }"
        />
        <path
          :d="cable"
          class="bridge-cable stroke-evergreen"
          stroke-width="2"
          vector-effect="non-scaling-stroke"
        />
        <line
          v-for="x in TOWERS"
          :key="x"
          :x1="x"
          :x2="x"
          :y1="TOWER_TOP - 4"
          :y2="DECK"
          class="bridge-tower stroke-evergreen stroke-[4] sm:stroke-[6]"
          vector-effect="non-scaling-stroke"
        />
      </g>
    </svg>

    <div class="flex h-7 sm:h-8">
      <div
        v-for="(band, i) in LEVEL_BANDS"
        :key="band.level"
        :class="LEVEL_TONE[band.level]"
        class="bridge-deck flex min-w-0 items-center justify-center px-1 text-[0.625rem] font-semibold sm:justify-start sm:px-4 sm:text-xs"
        :style="{ width: `${band.to - band.from}%`, '--i': i }"
      >
        <span class="truncate">{{ LEVEL_LABELS[band.level] }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .bridge-tower {
    transform-box: fill-box;
    transform-origin: bottom;
    animation: grow-y 1s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
  }

  .bridge-cable {
    animation: fade-in 1.2s ease-out 0.6s both;
  }

  .bridge-hanger {
    transform-box: fill-box;
    transform-origin: top;
    animation: grow-y 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: calc(0.8s + var(--i) * 22ms);
  }

  .bridge-deck {
    transform-origin: left;
    animation: grow-x 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: calc(var(--i) * 110ms);
  }
}

@keyframes grow-y {
  from {
    transform: scaleY(0);
  }
}

@keyframes grow-x {
  from {
    transform: scaleX(0);
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
}
</style>
