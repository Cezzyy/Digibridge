<script setup lang="ts">
import { AGE_GROUP_LABELS, SEX_LABELS } from '@digibridge/shared'
import type { RespondentRow } from '../../composables/useRespondents'
import { wholePct } from '../../lib/levels'
import LevelBadge from '../results/LevelBadge.vue'
import { formatDay } from './link-text'
import { classText, modeText, nameText } from './respondent-text'
import RespondentStatusBadge from './RespondentStatusBadge.vue'

// One page of respondents (DSH-05): a table from `md`, a list of cards on phones. Each name is a
// button that opens the respondent's details. Hidden names read Hidden (PRO-05), and the school
// cells of online respondents are empty.
defineProps<{ rows: readonly RespondentRow[] }>()
const emit = defineEmits<{ open: [id: string] }>()

const EMPTY = '—'
</script>

<template>
  <!-- Phones: cards. -->
  <ul class="divide-y divide-line md:hidden">
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
          <span v-if="row.overallLevel && row.overallPct !== null" class="flex items-center gap-2">
            <span class="font-semibold text-ink tabular-nums">{{ wholePct(row.overallPct) }}%</span>
            <LevelBadge :level="row.overallLevel" />
          </span>
        </span>
      </button>
    </li>
  </ul>

  <!-- From md: a table. It scrolls sideways inside its card if the columns don't fit. -->
  <div class="hidden overflow-x-auto md:block">
    <table class="w-full text-left">
      <thead class="border-b border-line text-sm text-quiet">
        <tr>
          <th scope="col" class="px-4 py-3 font-semibold sm:pl-6">Name</th>
          <th scope="col" class="px-4 py-3 font-semibold">Came in</th>
          <th scope="col" class="px-4 py-3 font-semibold">Course and year</th>
          <th scope="col" class="px-4 py-3 font-semibold">Sex, age</th>
          <th scope="col" class="px-4 py-3 font-semibold">Status</th>
          <th scope="col" class="px-4 py-3 font-semibold">Score</th>
          <th scope="col" class="px-4 py-3 font-semibold sm:pr-6">Consented</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-line">
        <tr
          v-for="row in rows"
          :key="row.id"
          class="cursor-pointer transition-colors hover:bg-mist-soft"
          @click="emit('open', row.id)"
        >
          <th scope="row" class="max-w-56 px-4 py-3 font-semibold sm:pl-6">
            <button
              type="button"
              class="block max-w-full truncate rounded-control text-left hover:text-evergreen hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-evergreen"
              :class="{ 'text-quiet italic': row.identityHidden }"
              @click.stop="emit('open', row.id)"
            >
              {{ nameText(row) }}
            </button>
            <span v-if="row.studentNumber" class="block text-sm font-normal text-quiet">
              {{ row.studentNumber }}
            </span>
          </th>
          <td class="max-w-48 truncate px-4 py-3 text-quiet">{{ modeText(row) }}</td>
          <td class="px-4 py-3 whitespace-nowrap text-quiet">{{ classText(row) ?? EMPTY }}</td>
          <td class="px-4 py-3 whitespace-nowrap text-quiet">
            {{ SEX_LABELS[row.sex] }}, {{ row.age }}
            <span class="sr-only">({{ AGE_GROUP_LABELS[row.ageGroup] }})</span>
          </td>
          <td class="px-4 py-3"><RespondentStatusBadge :status="row.status" /></td>
          <td class="px-4 py-3">
            <span
              v-if="row.overallLevel && row.overallPct !== null"
              class="flex items-center gap-2 whitespace-nowrap"
            >
              <span class="w-[3.5ch] text-right font-semibold tabular-nums">
                {{ wholePct(row.overallPct) }}%
              </span>
              <LevelBadge :level="row.overallLevel" />
            </span>
            <span v-else class="text-quiet">{{ EMPTY }}</span>
          </td>
          <td class="px-4 py-3 whitespace-nowrap text-quiet sm:pr-6">
            {{ formatDay(row.consentedAt) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
