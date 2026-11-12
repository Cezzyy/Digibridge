<script setup lang="ts">
import SkeletonText from '../results/SkeletonText.vue'

// RespondentsTable while a page loads: cards on phones, and from `md` the table with its real
// column headings, so the columns sit where they will. Each cell has a placeholder the size of
// its usual text; the status and level pills keep a hidden word so they take the same room. Rows
// take turns between a school respondent (student number, course and year) and an online one.
// Change it along with RespondentsTable.
const BLOCK = 'bg-skeleton motion-safe:animate-skeleton'
const STATUS_PILL = `inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap text-transparent ${BLOCK}`
const LEVEL_PILL = `inline-flex w-fit shrink-0 items-center rounded-full px-3 py-0.5 font-display text-sm font-bold whitespace-nowrap text-transparent ${BLOCK}`

const ROWS = [
  { name: 'w-[9em]', mode: 'w-[8em]', school: true },
  { name: 'w-[7em]', mode: 'w-[3.5em]', school: false },
  { name: 'w-[10em]', mode: 'w-[9em]', school: true },
  { name: 'w-[8em]', mode: 'w-[3.5em]', school: false },
  { name: 'w-[6.5em]', mode: 'w-[8em]', school: true },
  { name: 'w-[9.5em]', mode: 'w-[3.5em]', school: false },
  { name: 'w-[7.5em]', mode: 'w-[9em]', school: true },
  { name: 'w-[8.5em]', mode: 'w-[3.5em]', school: false },
]
const COLUMNS = ['Name', 'Came in', 'Course and year', 'Sex, age', 'Status', 'Score', 'Consented']
</script>

<template>
  <div aria-hidden="true">
    <!-- Phones: cards. -->
    <ul class="divide-y divide-line md:hidden">
      <li v-for="(row, i) in ROWS" :key="i" class="flex flex-col gap-2 p-4">
        <span class="flex w-full items-start justify-between gap-3">
          <span class="min-w-0">
            <span class="block font-semibold"><SkeletonText :class="row.name" /></span>
            <span class="block text-sm"><SkeletonText :class="row.mode" /></span>
          </span>
          <span :class="STATUS_PILL"><span class="size-2" />Finished</span>
        </span>
        <span class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span v-if="row.school"><SkeletonText class="w-[7.5em]" /></span>
          <span><SkeletonText class="w-[4.5em]" /></span>
          <span class="flex items-center gap-2">
            <span class="font-semibold"><SkeletonText class="w-[2.2em]" /></span>
            <span :class="LEVEL_PILL">Basic</span>
          </span>
        </span>
      </li>
    </ul>

    <!-- From md: a table. -->
    <div class="hidden overflow-x-auto md:block">
      <table class="w-full text-left">
        <thead class="border-b border-line text-sm text-quiet">
          <tr>
            <th
              v-for="(column, i) in COLUMNS"
              :key="column"
              scope="col"
              class="px-4 py-3 font-semibold"
              :class="{ 'sm:pl-6': i === 0, 'sm:pr-6': i === COLUMNS.length - 1 }"
            >
              {{ column }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr v-for="(row, i) in ROWS" :key="i">
            <td class="max-w-56 px-4 py-3 font-semibold sm:pl-6">
              <span class="block"><SkeletonText :class="row.name" /></span>
              <span v-if="row.school" class="block text-sm font-normal">
                <SkeletonText class="w-[5.5em]" />
              </span>
            </td>
            <td class="max-w-48 px-4 py-3"><SkeletonText :class="row.mode" /></td>
            <td class="px-4 py-3 whitespace-nowrap">
              <SkeletonText :class="row.school ? 'w-[7.5em]' : 'w-[1em]'" />
            </td>
            <td class="px-4 py-3 whitespace-nowrap"><SkeletonText class="w-[4.5em]" /></td>
            <td class="px-4 py-3">
              <span :class="STATUS_PILL"><span class="size-2" />Finished</span>
            </td>
            <td class="px-4 py-3">
              <span class="flex items-center gap-2 whitespace-nowrap">
                <span class="w-[3.5ch] text-right font-semibold"
                  ><SkeletonText class="w-full"
                /></span>
                <span :class="LEVEL_PILL">Basic</span>
              </span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap sm:pr-6"><SkeletonText class="w-[7.5em]" /></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
