<script setup lang="ts">
import { AREA_CODES, AREA_LABELS, type Mode, type RespondentStatus } from '@digibridge/shared'
import { computed } from 'vue'
import SkeletonText from '../results/SkeletonText.vue'
import RespondentStatusBadge from './RespondentStatusBadge.vue'

// The drawer's body while a respondent loads: the same cards, padding and type sizes as
// RespondentDrawer, with placeholders where their details go. `mode` and `status` come from the
// list row when the drawer was opened from it, so the profile has the right rows and the cards
// below match where they are: not started, still taking it, or finished (the default, and what
// most are). Fixed words (headings, profile labels, area names, choice letters) are shown.
// Change it along with RespondentDrawer and AnswerSheet.
const props = defineProps<{ isAdmin: boolean; mode?: Mode; status?: RespondentStatus }>()

const BLOCK = 'bg-skeleton motion-safe:animate-skeleton'
const STATUS_PILL = `inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap text-transparent ${BLOCK}`
const LEVEL_PILL = `inline-flex w-fit shrink-0 items-center rounded-full font-display font-bold whitespace-nowrap text-transparent ${BLOCK}`

const SCHOOL_ROWS = [
  { label: 'Student number', width: 'w-[6em]' },
  { label: 'Course and year', width: 'w-[8em]' },
  { label: 'Came in', width: 'w-[9em]' },
]
const SHARED_ROWS = [
  { label: 'Sex', width: 'w-[3.5em]' },
  { label: 'Age', width: 'w-[7em]' },
  { label: 'Devices', width: 'w-[10em]' },
  { label: 'Internet', width: 'w-[9em]' },
  { label: 'Consented', width: 'w-[7.5em]' },
]
const profileRows = computed(() => [
  ...(props.mode === 'school' ? SCHOOL_ROWS : [{ label: 'Came in', width: 'w-[3.5em]' }]),
  ...SHARED_ROWS,
])

const started = computed(() => props.status !== 'not_started')
const inProgress = computed(() => props.status === 'in_progress')

const SUS_ROWS = [
  'w-4/5',
  'w-3/5',
  'w-2/3',
  'w-11/12',
  'w-3/4',
  'w-3/5',
  'w-4/5',
  'w-1/2',
  'w-2/3',
  'w-11/12',
]
const LETTERS = ['A', 'B', 'C', 'D']
const ANSWER_ITEMS = [
  { stem: ['w-full', 'w-3/5'], choices: ['w-1/2', 'w-2/3', 'w-2/5', 'w-3/5'] },
  { stem: ['w-full', 'w-full', 'w-1/4'], choices: ['w-2/3', 'w-2/5', 'w-3/5', 'w-1/2'] },
  { stem: ['w-5/6'], choices: ['w-2/5', 'w-1/2', 'w-3/4', 'w-3/5'] },
]
</script>

<template>
  <div aria-hidden="true" class="space-y-5">
    <section class="rounded-card border border-line bg-surface p-5">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-lg font-bold">Profile</h3>
        <RespondentStatusBadge v-if="status" :status="status" />
        <span v-else :class="STATUS_PILL"><span class="size-2" />Finished</span>
      </div>
      <dl class="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <div v-for="row in profileRows" :key="row.label">
          <dt class="text-sm text-quiet">{{ row.label }}</dt>
          <dd class="font-semibold"><SkeletonText :class="row.width" /></dd>
        </div>
      </dl>
    </section>

    <p
      v-if="!started"
      class="rounded-card border border-dashed border-line-strong/60 p-5 text-quiet"
    >
      They saved their profile but haven’t started the assessment.
    </p>

    <template v-else>
      <section class="rounded-card border border-line bg-surface p-5">
        <h3 class="text-lg font-bold">Results</h3>
        <p v-if="inProgress" class="mt-2">
          <SkeletonText class="w-full" />
          <br />
          <SkeletonText class="w-1/2" />
        </p>
        <template v-else>
          <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span :class="LEVEL_PILL" class="px-4 py-1.5 text-2xl">Basic</span>
            <p>
              <span class="font-display text-2xl font-bold"
                ><SkeletonText class="w-[2.2em]"
              /></span>
              <SkeletonText class="ml-1 w-[7em]" />
            </p>
          </div>
          <p class="mt-2 text-sm"><SkeletonText class="w-[16em]" /></p>
          <ul class="mt-5 space-y-4">
            <li v-for="area in AREA_CODES" :key="area">
              <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span class="font-semibold">{{ AREA_LABELS[area] }}</span>
                <span class="flex items-center gap-2 text-sm">
                  <SkeletonText class="w-[7.5em]" />
                  <span :class="LEVEL_PILL" class="px-3 py-0.5 text-sm">Basic</span>
                </span>
              </div>
              <div class="mt-2 h-2.5 rounded-full bg-track" />
            </li>
          </ul>
        </template>
      </section>

      <section class="rounded-card border border-line bg-surface p-5">
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <h3 class="text-lg font-bold">Usability survey</h3>
          <p v-if="!inProgress" class="font-display text-2xl font-bold">
            <SkeletonText class="w-[1.6em]" />
            <span class="text-base font-normal text-quiet"> of 100</span>
          </p>
        </div>
        <!-- No one answers the survey before their results. -->
        <p v-if="inProgress" class="mt-2 text-quiet">Not answered.</p>
        <ol v-else class="mt-3 divide-y divide-line">
          <li
            v-for="(width, i) in SUS_ROWS"
            :key="i"
            class="flex items-start justify-between gap-4 py-2"
          >
            <span class="min-w-0 flex-1"><SkeletonText :class="width" /></span>
            <span class="shrink-0 text-right text-sm font-semibold whitespace-nowrap">
              <SkeletonText class="w-[0.6em]" />
              <span class="block font-normal"><SkeletonText class="w-[6.5em]" /></span>
            </span>
          </li>
        </ol>
      </section>

      <section v-if="isAdmin" class="rounded-card border border-line bg-surface p-5">
        <h3 class="text-lg font-bold">Answers</h3>
        <p class="mt-1 text-quiet">
          Each item in the order they saw it. Only admins see this; the respondent never sees which
          items they got right.
        </p>
        <div class="mt-5">
          <div class="flex flex-wrap items-baseline justify-between gap-x-3">
            <h4 class="font-bold">{{ AREA_LABELS[AREA_CODES[0]] }}</h4>
            <p class="text-sm"><SkeletonText class="w-[6em]" /></p>
          </div>
          <ol class="mt-3 space-y-3">
            <li
              v-for="(item, n) in ANSWER_ITEMS"
              :key="n"
              class="rounded-card border border-line p-4"
            >
              <div class="flex items-start gap-3">
                <span class="size-7 shrink-0 rounded-full" :class="BLOCK" />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold"><SkeletonText class="w-[8em]" /></p>
                  <p class="mt-1">
                    <template v-for="(width, i) in item.stem" :key="i">
                      <br v-if="i" />
                      <SkeletonText :class="width" />
                    </template>
                  </p>
                  <ul class="mt-3 space-y-1.5">
                    <li
                      v-for="(width, i) in item.choices"
                      :key="i"
                      class="flex items-start gap-2.5 rounded-control px-2.5 py-1.5"
                    >
                      <span class="w-4 shrink-0 font-semibold text-quiet">{{ LETTERS[i] }}</span>
                      <span class="min-w-0 flex-1"><SkeletonText :class="width" /></span>
                    </li>
                  </ul>
                </div>
              </div>
            </li>
          </ol>
        </div>
      </section>
    </template>
  </div>
</template>
