<script setup lang="ts">
import { AREA_LABELS, LEVEL_LABELS, LEVELS, type AreaCode, type Level } from '@digibridge/shared'
import { computed } from 'vue'
import { LEVEL_TONE } from '../../lib/levels'
import LevelKey from '../results/LevelKey.vue'
import { shareOf } from './stats-text'

// How many reached each level, overall and in each area (DSH-02): one 100% bar per row, a
// segment per level in its level color, lowest first, with 2 px gaps. Counts sit in segments
// wide enough for them; hovering a segment shows its count and share. The key names the colors,
// and "Show as a table" gives the same numbers as text.
const props = defineProps<{
  overall: Record<Level, number>
  areas: readonly { area: AreaCode; levels: Record<Level, number> }[]
}>()

const rows = computed(() =>
  [
    { label: 'Overall', levels: props.overall },
    ...props.areas.map((a) => ({ label: AREA_LABELS[a.area], levels: a.levels })),
  ].map((row) => {
    const total = LEVELS.reduce((sum, level) => sum + row.levels[level], 0)
    return {
      ...row,
      total,
      parts: LEVELS.map((level) => ({
        level,
        count: row.levels[level],
        share: shareOf(row.levels[level], total),
      })).filter((part) => part.count > 0),
    }
  }),
)
</script>

<template>
  <div>
    <ul class="space-y-5" aria-hidden="true">
      <li v-for="row in rows" :key="row.label">
        <div class="flex items-baseline justify-between gap-3">
          <span class="font-semibold" :class="{ 'text-lg': row.label === 'Overall' }">{{
            row.label
          }}</span>
          <span class="text-sm text-quiet tabular-nums">{{ row.total }} finished</span>
        </div>
        <div class="mt-2 flex h-7 gap-0.5 rounded-[4px] bg-track">
          <span
            v-for="part in row.parts"
            :key="part.level"
            class="group relative flex h-full min-w-1 items-center justify-center rounded-[4px] text-sm font-semibold tabular-nums"
            :class="LEVEL_TONE[part.level]"
            :style="{ width: `${part.share}%` }"
          >
            <span v-if="part.share >= 10">{{ part.count }}</span>
            <span
              class="pointer-events-none invisible absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-control bg-ink px-2.5 py-1 text-sm font-semibold whitespace-nowrap text-surface group-hover:visible"
            >
              {{ LEVEL_LABELS[part.level] }}: {{ part.count }} ({{ Math.round(part.share) }}%)
            </span>
          </span>
        </div>
      </li>
    </ul>
    <LevelKey class="mt-5 !justify-start" />

    <details class="mt-4">
      <summary class="cursor-pointer font-semibold text-evergreen">Show as a table</summary>
      <div class="mt-3 overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-line text-quiet">
            <tr>
              <th scope="col" class="py-2 pr-4 font-semibold">Area</th>
              <th
                v-for="level in LEVELS"
                :key="level"
                scope="col"
                class="px-3 py-2 text-right font-semibold"
              >
                {{ LEVEL_LABELS[level] }}
              </th>
              <th scope="col" class="py-2 pl-3 text-right font-semibold">Finished</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line tabular-nums">
            <tr v-for="row in rows" :key="row.label">
              <th scope="row" class="py-2 pr-4 font-semibold">{{ row.label }}</th>
              <td v-for="level in LEVELS" :key="level" class="px-3 py-2 text-right">
                {{ row.levels[level] }}
              </td>
              <td class="py-2 pl-3 text-right">{{ row.total }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </div>
</template>
