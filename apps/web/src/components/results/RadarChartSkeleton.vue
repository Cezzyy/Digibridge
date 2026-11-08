<script setup lang="ts">
import type { Level } from '@digibridge/shared'
import { LEVEL_BANDS } from '../../lib/levels'
import LevelKey from './LevelKey.vue'

// RadarChart's loading placeholder: its rings, axes and the 3 label spots, drawn where the chart
// will draw them, with the real key under it. Chart.js sizes the chart from its width, so the
// numbers in the style below were measured from the real chart (Chart.js 4.6, aspect ratio 1.25,
// 11 px labels below 400 px wide and 13 px from there): the ring's radius, its center (a little
// left of the middle, since the right label is the widest) and each label's place beside its
// point. Update them if the chart's labels, font or aspect ratio change.

// A disc out to the top of each level's band, largest first so the smaller ones sit on top,
// darkest outside like the chart's level colors.
const TONE = {
  advanced: 'bg-line',
  intermediate: 'bg-mist',
  basic: 'bg-track',
  beginner: 'bg-mist-soft',
} as const satisfies Record<Level, string>
const RINGS = LEVEL_BANDS.map((band) => ({ size: band.to / 100, tone: TONE[band.level] })).reverse()

// Axes from the center: up, then clockwise to the lower right and lower left, as Chart.js draws
// 3 points. Each line points down before it's turned.
const AXES = [180, -60, 60]
</script>

<template>
  <figure>
    <div class="relative mx-auto w-full max-w-lg">
      <div class="chart">
        <div aria-hidden="true" class="plot motion-safe:animate-skeleton">
          <span
            v-for="ring in RINGS"
            :key="ring.size"
            class="disc border border-surface"
            :class="ring.tone"
            :style="{ '--f': ring.size }"
          />
          <span
            v-for="turn in AXES"
            :key="turn"
            class="axis bg-surface"
            :style="{ rotate: `${turn}deg` }"
          />

          <!-- Area 1 on top, 2 lines centered; area 2 lower right, 2 lines from the left; area
               3 lower left, 1 line ending at the right. Widths match the labels' text. -->
          <span class="label label-top items-center">
            <span class="w-[6.9em] bg-mist" />
            <span class="w-[5.4em] bg-mist" />
          </span>
          <span class="label label-right items-start">
            <span class="w-[8.7em] bg-mist" />
            <span class="w-[6.6em] bg-mist" />
          </span>
          <span class="label label-left items-end">
            <span class="w-[5.6em] bg-mist" />
          </span>
        </div>
      </div>
    </div>
    <figcaption class="mt-4"><LevelKey /></figcaption>
  </figure>
</template>

<style scoped>
.chart {
  position: relative;
  container-type: inline-size;
  aspect-ratio: 5 / 4;
}

/* --r: the outer ring's radius, --cx and --cy: its center, --fs: the label size. */
.plot {
  --r: max(0px, calc(57.8cqw - 116.5px));
  --cx: calc(50cqw - 19.5px);
  --cy: calc(40cqw + 16px);
  --fs: 11px;
  position: absolute;
  inset: 0;
  font-size: var(--fs);
}

@container (width >= 400px) {
  .plot {
    --r: calc(57.8cqw - 137px);
    --cx: calc(50cqw - 24px);
    --cy: calc(40cqw + 18px);
    --fs: 13px;
  }
}

.disc {
  position: absolute;
  left: var(--cx);
  top: var(--cy);
  width: calc(2 * var(--r) * var(--f));
  aspect-ratio: 1;
  translate: -50% -50%;
  border-radius: 9999px;
}

.axis {
  position: absolute;
  left: var(--cx);
  top: var(--cy);
  width: 1px;
  height: var(--r);
  translate: -50% 0;
  transform-origin: top center;
}

/* A label of 1 or 2 lines, 1.2em apart as in the chart, 6px out from its point. */
.label {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  padding-block: 0.25em;
}

.label > span {
  display: block;
  height: 0.7em;
  border-radius: 9999px;
}

.label-top {
  left: var(--cx);
  top: calc(var(--cy) - var(--r) - 6px);
  translate: -50% -100%;
}

.label-right {
  left: calc(var(--cx) + 0.866 * var(--r) + 6px);
  top: calc(var(--cy) + 0.5 * var(--r) + 3px);
}

.label-left {
  left: calc(var(--cx) - 0.866 * var(--r) - 6px);
  top: calc(var(--cy) + 0.5 * var(--r) + 3px);
  translate: -100% 0;
}
</style>
