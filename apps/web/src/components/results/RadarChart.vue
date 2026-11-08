<script setup lang="ts">
import { AREA_LABELS, LEVEL_LABELS, type AreaCode, type Level } from '@digibridge/shared'
import {
  Chart as ChartJS,
  Filler,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type Plugin,
} from 'chart.js'
import { computed } from 'vue'
import { Radar } from 'vue-chartjs'
import { LEVEL_BANDS, levelRange, wholePct } from '../../lib/levels'
import { prefersReducedMotion } from '../../lib/motion'

// The 3 areas' scores on axes from 0 to 100 (RES-01), drawn by Chart.js over rings colored by
// level, so the shape shows which level each area reached. The page lists the same scores as
// text; this canvas is a picture with a label for screen readers.
ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip)

const props = defineProps<{ areas: readonly { area: AreaCode; pct: number; level: Level }[] }>()

// The canvas can't use Tailwind classes, so it reads the design tokens from style.css.
const styles = getComputedStyle(document.documentElement)
const token = (name: string) => styles.getPropertyValue(`--color-${name}`).trim()
/** A #rrggbb token with an alpha channel, as #rrggbbaa. */
const faded = (hex: string, alpha: number) =>
  hex +
  Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')
const FONT = getComputedStyle(document.body).fontFamily

// Each level's ring, lightest in the middle. The darker levels get less alpha, so the student's
// shape stays easy to see on top of them. `swatch` is the same color for the key under the chart.
const RING = {
  beginner: { color: 'level-1', alpha: 0.7, swatch: 'bg-level-1/70' },
  basic: { color: 'level-2', alpha: 0.45, swatch: 'bg-level-2/45' },
  intermediate: { color: 'level-3', alpha: 0.25, swatch: 'bg-level-3/25' },
  advanced: { color: 'level-4', alpha: 0.2, swatch: 'bg-level-4/20' },
} as const satisfies Record<Level, { color: string; alpha: number; swatch: string }>

const levelRings: Plugin<'radar'> = {
  id: 'levelRings',
  // Before the scale draws its grid, so the ring lines stay on top of the fills.
  beforeDraw(chart) {
    const scale = chart.scales.r as RadialLinearScale | undefined
    if (!scale) return
    const { ctx } = chart
    ctx.save()
    for (const band of LEVEL_BANDS) {
      ctx.beginPath()
      ctx.arc(
        scale.xCenter,
        scale.yCenter,
        scale.getDistanceFromCenterForValue(band.to),
        0,
        2 * Math.PI,
      )
      ctx.arc(
        scale.xCenter,
        scale.yCenter,
        scale.getDistanceFromCenterForValue(band.from),
        0,
        2 * Math.PI,
        true,
      )
      ctx.fillStyle = faded(token(RING[band.level].color), RING[band.level].alpha)
      ctx.fill()
    }
    ctx.restore()
  },
}

// Rings where each level starts, plus the edge.
const TICKS = [0, ...LEVEL_BANDS.map((band) => band.to)]

/** An area's name in lines of about 18 characters, so the labels fit around a phone-sized chart. */
function wrap(text: string, width = 18) {
  const lines: string[] = []
  for (const word of text.split(' ')) {
    const last = lines.at(-1)
    if (last !== undefined && last.length + word.length + 1 <= width)
      lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  return lines
}

const shown = (pct: number) => `${wholePct(pct)}%`

const data = computed<ChartData<'radar'>>(() => ({
  labels: props.areas.map((a) => wrap(AREA_LABELS[a.area])),
  datasets: [
    {
      data: props.areas.map((a) => a.pct),
      fill: true,
      backgroundColor: faded(token('marigold'), 0.45),
      borderColor: token('ink'),
      borderWidth: 2,
      pointBackgroundColor: token('marigold'),
      pointBorderColor: token('ink'),
      pointBorderWidth: 2,
      pointRadius: 5,
      pointHoverRadius: 7,
    },
  ],
}))

const options = computed<ChartOptions<'radar'>>(() => ({
  responsive: true,
  maintainAspectRatio: true,
  // Wider than tall: the labels sit left and right of the bottom corners.
  aspectRatio: 1.25,
  animation: prefersReducedMotion() ? false : { duration: 900, easing: 'easeOutQuart' },
  scales: {
    r: {
      min: 0,
      max: 100,
      afterBuildTicks: (scale) => {
        scale.ticks = TICKS.map((value) => ({ value }))
      },
      // No numbers on the rings: they'd sit under the top point, and the key names each ring.
      ticks: { display: false },
      grid: { circular: true, color: token('line') },
      angleLines: { color: token('line') },
      pointLabels: {
        color: token('ink'),
        // Smaller on phones, where the side labels would leave the chart little room.
        font: (ctx) => ({
          family: FONT,
          size: ctx.chart.width < 400 ? 11 : 13,
          weight: 600,
          lineHeight: 1.2,
        }),
        padding: 6,
      },
    },
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: token('ink'),
      titleFont: { family: FONT, weight: 600 },
      bodyFont: { family: FONT },
      displayColors: false,
      callbacks: {
        title: (items) => {
          const area = props.areas[items[0]?.dataIndex ?? -1]
          return area ? AREA_LABELS[area.area] : ''
        },
        label: (item) => {
          const area = props.areas[item.dataIndex]
          return area ? `${shown(area.pct)} · ${LEVEL_LABELS[area.level]}` : ''
        },
      },
    },
  },
}))

const label = computed(
  () =>
    `Chart of your scores: ${props.areas
      .map((a) => `${AREA_LABELS[a.area]} ${shown(a.pct)}, ${LEVEL_LABELS[a.level]}`)
      .join('; ')}.`,
)
</script>

<template>
  <figure>
    <div class="relative mx-auto w-full max-w-lg">
      <Radar :data="data" :options="options" :plugins="[levelRings]" :aria-label="label" />
    </div>
    <!-- The key to the rings. -->
    <figcaption class="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
      <span v-for="band in LEVEL_BANDS" :key="band.level" class="flex items-center gap-2">
        <span
          aria-hidden="true"
          class="size-3.5 rounded-full ring-1 ring-line-strong/40 ring-inset"
          :class="RING[band.level].swatch"
        />
        <span class="flex gap-1.5">
          <span class="font-semibold">{{ LEVEL_LABELS[band.level] }}</span>
          <span class="text-quiet">{{ levelRange(band) }}</span>
        </span>
      </span>
    </figcaption>
  </figure>
</template>
