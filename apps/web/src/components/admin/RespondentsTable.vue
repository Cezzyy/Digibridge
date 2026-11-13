<script setup lang="ts">
import { AGE_GROUP_LABELS, SEX_LABELS } from '@digibridge/shared'
import type { RespondentRow } from '../../composables/useRespondents'
import { wholePct } from '../../lib/levels'
import LevelBadge from '../results/LevelBadge.vue'
import { formatDay } from './link-text'
import { classText, modeText, nameText } from './respondent-text'
import RespondentStatusBadge from './RespondentStatusBadge.vue'

// One page of respondents (DSH-05). It never scrolls sideways: the component is a size container,
// cards while it's narrower than 48rem, then a fixed-layout table that can't grow wider than its
// card. Sex and age join from 56rem and the consent day from 72rem (both are in the drawer too);
// the name and Came in columns share what's left and cut long text short. Each name is a button
// that opens the respondent's details. Hidden names read Hidden (PRO-05), and online respondents
// have no course and year. Change RespondentsTableSkeleton along with it.
defineProps<{ rows: readonly RespondentRow[] }>()
const emit = defineEmits<{ open: [id: string] }>()

const EMPTY = '—'
</script>

<template>
  <div class="@container">
    <!-- Narrow: cards. -->
    <ul class="divide-y divide-line @3xl:hidden">
      <li v-for="row in rows" :key="row.id">
        <button
          type="button"
          class="flex w-full flex-col gap-2 p-4 text-left transition-colors hover:bg-mist-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-evergreen"
          @click="emit('open', row.id)"
        >
          <span class="flex w-full items-start justify-between gap-3">
            <span class="min-w-0">
              <span
                class="block truncate font-semibold"
                :class="{ 'text-quiet italic': row.identityHidden }"
              >
                {{ nameText(row) }}
              </span>
              <span class="block truncate text-sm text-quiet">{{ modeText(row) }}</span>
            </span>
            <RespondentStatusBadge :status="row.status" />
          </span>
          <span class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-quiet">
            <span v-if="classText(row)">{{ classText(row) }}</span>
            <span>{{ SEX_LABELS[row.sex] }}, {{ row.age }}</span>
            <span
              v-if="row.overallLevel && row.overallPct !== null"
              class="flex items-center gap-2"
            >
              <span class="font-semibold text-ink tabular-nums">
                {{ wholePct(row.overallPct) }}%
              </span>
              <LevelBadge :level="row.overallLevel" />
            </span>
          </span>
        </button>
      </li>
    </ul>

    <!-- From 48rem: a fixed-layout table, as wide as the card and no wider. -->
    <table class="hidden w-full table-fixed text-left @3xl:table">
      <thead class="border-b border-line text-sm text-quiet">
        <tr>
          <th scope="col" class="py-3 pr-4 pl-6 font-semibold">Name</th>
          <th scope="col" class="px-4 py-3 font-semibold">Came in</th>
          <th scope="col" class="hidden w-40 px-4 py-3 font-semibold @4xl:table-cell">Sex, age</th>
          <th scope="col" class="w-40 px-4 py-3 font-semibold">Status</th>
          <th scope="col" class="w-48 py-3 pr-6 pl-4 font-semibold @6xl:pr-4">Score</th>
          <th scope="col" class="hidden w-44 py-3 pr-6 pl-4 font-semibold @6xl:table-cell">
            Consented
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-line">
        <tr
          v-for="row in rows"
          :key="row.id"
          class="cursor-pointer transition-colors hover:bg-mist-soft"
          @click="emit('open', row.id)"
        >
          <th scope="row" class="py-3 pr-4 pl-6 font-semibold">
            <button
              type="button"
              class="block max-w-full truncate rounded-control text-left hover:text-evergreen hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-evergreen"
              :class="{ 'text-quiet italic': row.identityHidden }"
              :title="nameText(row)"
              @click.stop="emit('open', row.id)"
            >
              {{ nameText(row) }}
            </button>
            <span v-if="row.studentNumber" class="block truncate text-sm font-normal text-quiet">
              {{ row.studentNumber }}
            </span>
          </th>
          <td class="px-4 py-3 text-quiet">
            <span class="block truncate" :title="modeText(row)">{{ modeText(row) }}</span>
            <span v-if="classText(row)" class="block truncate text-sm">{{ classText(row) }}</span>
          </td>
          <td class="hidden px-4 py-3 text-quiet @4xl:table-cell">
            <span class="block truncate">{{ SEX_LABELS[row.sex] }}</span>
            <span class="block text-sm">
              {{ row.age }} years
              <span class="sr-only">({{ AGE_GROUP_LABELS[row.ageGroup] }})</span>
            </span>
          </td>
          <td class="px-4 py-3"><RespondentStatusBadge :status="row.status" /></td>
          <td class="py-3 pr-6 pl-4 @6xl:pr-4">
            <span
              v-if="row.overallLevel && row.overallPct !== null"
              class="flex items-center gap-2 whitespace-nowrap"
            >
              <span class="w-[4ch] shrink-0 text-right font-semibold tabular-nums">
                {{ wholePct(row.overallPct) }}%
              </span>
              <LevelBadge :level="row.overallLevel" />
            </span>
            <span v-else class="text-quiet">{{ EMPTY }}</span>
          </td>
          <td class="hidden py-3 pr-6 pl-4 text-quiet @6xl:table-cell">
            {{ formatDay(row.consentedAt) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
