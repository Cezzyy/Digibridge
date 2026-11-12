<script setup lang="ts">
import {
  AREA_CODES,
  AREA_LABELS,
  MULTI_PICK_GROUPS,
  SCHOOL_ONLY_GROUPS,
  STATS_GROUP_LABELS,
  STATS_GROUPS,
  type AreaCode,
  type StatsGroup,
} from '@digibridge/shared'
import { computed, ref } from 'vue'
import type { AdminStats } from '../../composables/useAdminStats'
import { LEVEL_BANDS } from '../../lib/levels'
import SelectField from '../form/SelectField.vue'
import SkeletonText from '../results/SkeletonText.vue'
import { ICONS } from './admin-icons'
import { pctText } from './stats-text'
import StrokeIcon from './StrokeIcon.vue'

// Average score by a chosen grouping (DSH-04): one horizontal bar per group on a 0 to 100 scale,
// with faint ticks where each level starts, the average at the bar's end and how many finished.
// One measure at a time (overall or one area), so it's one series in one color. Groupings only
// school respondents have say so, and so do the ones where a respondent can be in several groups.
// Null while the numbers load: the controls, note and scale are drawn, with placeholder bars
// (two for mode, online and school, else three).
const props = defineProps<{ comparison: AdminStats['comparison'] | null }>()
const groupBy = defineModel<StatsGroup>('groupBy', { required: true })

type Measure = 'overall' | AreaCode
const measure = ref<Measure>('overall')

const groupOptions = STATS_GROUPS.map((value) => ({ value, label: STATS_GROUP_LABELS[value] }))
const measureOptions: { value: Measure; label: string }[] = [
  { value: 'overall', label: 'Overall score' },
  ...AREA_CODES.map((area) => ({ value: area, label: AREA_LABELS[area] })),
]

const bars = computed(
  () =>
    props.comparison?.groups.map((group) => ({
      ...group,
      pct:
        measure.value === 'overall'
          ? group.averageOverallPct
          : (group.areas.find((a) => a.area === measure.value)?.averagePct ?? null),
    })) ?? null,
)
const placeholderBars = computed(() =>
  (groupBy.value === 'mode' ? ['w-[4em]', 'w-[7em]'] : ['w-[6em]', 'w-[8em]', 'w-[5em]']).map(
    (label, i) => ({ label, fill: ['62%', '48%', '55%'][i] }),
  ),
)
const schoolOnly = computed(() =>
  (SCHOOL_ONLY_GROUPS as readonly StatsGroup[]).includes(groupBy.value),
)
const multiPick = computed(() =>
  (MULTI_PICK_GROUPS as readonly StatsGroup[]).includes(groupBy.value),
)
const TICKS = LEVEL_BANDS.slice(1).map((band) => band.from)
</script>

<template>
  <div>
    <div class="grid gap-4 sm:grid-cols-2">
      <SelectField v-model="groupBy" label="Group by" :options="groupOptions" />
      <SelectField v-model="measure" label="Show" :options="measureOptions" />
    </div>

    <p v-if="schoolOnly || multiPick" class="mt-4 flex gap-2 text-quiet">
      <StrokeIcon :d="ICONS.school" class="mt-0.5 size-5 shrink-0" />
      <template v-if="schoolOnly">
        {{ STATS_GROUP_LABELS[groupBy] }} is asked through school links only, so online respondents
        are left out.
      </template>
      <template v-else>
        Respondents can pick more than one, so one respondent can count in several groups.
      </template>
    </p>

    <p v-if="bars?.length === 0" class="mt-6 rounded-card bg-mist-soft p-5 text-quiet">
      No finished attempts to compare yet.
    </p>
    <template v-else>
      <ul v-if="!bars" class="mt-6 space-y-4" aria-hidden="true">
        <li
          v-for="bar in placeholderBars"
          :key="bar.label"
          class="grid gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,12rem)_1fr]"
        >
          <span class="min-w-0">
            <span class="block font-semibold"><SkeletonText :class="bar.label" /></span>
            <span class="block text-sm"><SkeletonText class="w-[5.5em]" /></span>
          </span>
          <span class="flex items-center gap-3">
            <span class="relative h-6 flex-1 rounded-[4px] bg-track">
              <span
                class="absolute inset-y-0 left-0 rounded-[4px] bg-line-strong/20 motion-safe:animate-skeleton"
                :style="{ width: bar.fill }"
              />
              <span
                v-for="tick in TICKS"
                :key="tick"
                class="absolute inset-y-0 w-px bg-line-strong/40"
                :style="{ left: `${tick}%` }"
              />
            </span>
            <span class="w-[6ch] text-right font-semibold"><SkeletonText class="w-[3.5ch]" /></span>
          </span>
        </li>
      </ul>
      <ul v-else class="mt-6 space-y-4" aria-hidden="true">
        <li
          v-for="bar in bars"
          :key="bar.key"
          class="grid gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,12rem)_1fr]"
        >
          <span class="min-w-0">
            <span class="block truncate font-semibold">{{ bar.label }}</span>
            <span class="block text-sm text-quiet tabular-nums">{{ bar.finished }} finished</span>
          </span>
          <span class="flex items-center gap-3">
            <span class="relative h-6 flex-1 rounded-[4px] bg-track">
              <span
                v-for="tick in TICKS"
                :key="tick"
                class="absolute inset-y-0 w-px bg-line-strong/40"
                :style="{ left: `${tick}%` }"
              />
              <span
                v-if="bar.pct !== null"
                class="group absolute inset-y-0 left-0 rounded-[4px] bg-evergreen"
                :style="{ width: `${Math.max(bar.pct, 0.5)}%` }"
              >
                <span
                  class="pointer-events-none invisible absolute bottom-full left-full z-10 mb-2 -translate-x-1/2 rounded-control bg-ink px-2.5 py-1 text-sm font-semibold whitespace-nowrap text-surface group-hover:visible"
                >
                  {{ bar.label }}: {{ pctText(bar.pct) }} average, {{ bar.finished }} finished
                </span>
              </span>
            </span>
            <span class="w-[6ch] text-right font-semibold tabular-nums">{{
              pctText(bar.pct)
            }}</span>
          </span>
        </li>
      </ul>
      <p class="mt-3 text-sm text-quiet">
        Average of finished attempts, 0 to 100%. Faint lines mark where Basic, Intermediate and
        Advanced start.
      </p>

      <p v-if="!comparison" class="mt-4 font-semibold" aria-hidden="true">
        <SkeletonText class="w-[8.5em]" />
      </p>
      <details v-else class="mt-4">
        <summary class="cursor-pointer font-semibold text-evergreen">Show as a table</summary>
        <div class="mt-3 overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-line text-quiet">
              <tr>
                <th scope="col" class="py-2 pr-4 font-semibold">
                  {{ STATS_GROUP_LABELS[groupBy] }}
                </th>
                <th scope="col" class="px-3 py-2 text-right font-semibold">Finished</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold">Overall</th>
                <th
                  v-for="area in AREA_CODES"
                  :key="area"
                  scope="col"
                  class="px-3 py-2 text-right font-semibold"
                >
                  {{ AREA_LABELS[area] }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-line tabular-nums">
              <tr v-for="group in comparison.groups" :key="group.key">
                <th scope="row" class="py-2 pr-4 font-semibold">{{ group.label }}</th>
                <td class="px-3 py-2 text-right">{{ group.finished }}</td>
                <td class="px-3 py-2 text-right">{{ pctText(group.averageOverallPct) }}</td>
                <td v-for="area in group.areas" :key="area.area" class="px-3 py-2 text-right">
                  {{ pctText(area.averagePct) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </template>
  </div>
</template>
