<script setup lang="ts">
import SkeletonText from '../results/SkeletonText.vue'

// RespondentsTable while a page loads, with the same container sizes: cards while it's narrower
// than 48rem, then the fixed-layout table with its real column headings, so the columns sit where
// they will. Each cell has a placeholder the size of
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
</script>

<template>
  <div aria-hidden="true" class="@container">
    <!-- Narrow: cards. -->
    <ul class="divide-y divide-line @3xl:hidden">
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

    <!-- From 48rem: the table. -->
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
        <tr v-for="(row, i) in ROWS" :key="i">
          <td class="py-3 pr-4 pl-6 font-semibold">
            <span class="block"><SkeletonText :class="row.name" /></span>
            <span v-if="row.school" class="block text-sm font-normal">
              <SkeletonText class="w-[9em]" />
            </span>
          </td>
          <td class="px-4 py-3">
            <span class="block"><SkeletonText :class="row.mode" /></span>
            <span v-if="row.school" class="block text-sm">
              <SkeletonText class="w-[6.5em]" />
            </span>
          </td>
          <td class="hidden px-4 py-3 @4xl:table-cell">
            <span class="block"><SkeletonText class="w-[3em]" /></span>
            <span class="block text-sm"><SkeletonText class="w-[4em]" /></span>
          </td>
          <td class="px-4 py-3">
            <span :class="STATUS_PILL"><span class="size-2" />Finished</span>
          </td>
          <td class="py-3 pr-6 pl-4 @6xl:pr-4">
            <span class="flex items-center gap-2 whitespace-nowrap">
              <span class="w-[4ch] shrink-0 text-right font-semibold">
                <SkeletonText class="w-full" />
              </span>
              <span :class="LEVEL_PILL">Basic</span>
            </span>
          </td>
          <td class="hidden py-3 pr-6 pl-4 @6xl:table-cell">
            <SkeletonText class="w-[7.5em]" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
