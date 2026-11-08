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
import { LEVEL_BANDS, wholePct } from '../../lib/levels'
import { prefersReducedMotion } from '../../lib/motion'
import LevelKey from './LevelKey.vue'

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

// Each level's ring in its full color, lightest in the middle. LevelKey shows the same colors.
const RING = {
  beginner: 'level-1',
  basic: 'level-2',
  intermediate: 'level-3',
  advanced: 'level-4',
} as const satisfies Record<Level, string>

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
      ctx.fillStyle = token(RING[band.level])
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

const data = computed<ChartData<'radar'>>(() => {
  const scores = props.areas.map((a) => a.pct)
  return {
    labels: props.areas.map((a) => wrap(AREA_LABELS[a.area])),
    // Chart.js draws the first dataset on top: the score shape, then a wide white outline under
    // it, so the shape's edge stays clear on the dark outer rings too.
    datasets: [
      {
        data: scores,
        fill: true,
        backgroundColor: faded(token('marigold'), 0.7),
        borderColor: token('ink'),
        borderWidth: 2.5,
        pointBackgroundColor: token('marigold'),
        pointBorderColor: token('ink'),
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
      },
      {
        data: scores,
        fill: false,
        borderColor: '#ffffff',
        borderWidth: 7,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 0,
      },
    ],
  }
})

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
      // White lines show on every ring now that the rings are solid.
      grid: { circular: true, color: faded('#ffffff', 0.6) },
      angleLines: { color: faded('#ffffff', 0.6) },
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
      // Only the score shape, not its outline.
      filter: (item) => item.datasetIndex === 0,
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
    <figcaption class="mt-4"><LevelKey /></figcaption>
  </figure>
</template>
