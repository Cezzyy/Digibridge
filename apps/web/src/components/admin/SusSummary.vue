<script setup lang="ts">
import {
  SUS_ANSWER_MAX,
  SUS_ANSWER_MIN,
  SUS_BIN_WIDTH,
  SUS_STATEMENTS,
  SUS_TARGET_SCORE,
} from '@digibridge/shared'
import { computed } from 'vue'
import type { AdminStats } from '../../composables/useAdminStats'
import SkeletonText from '../results/SkeletonText.vue'
import { ICONS } from './admin-icons'
import { countText, NO_VALUE } from './stats-text'
import StrokeIcon from './StrokeIcon.vue'

// The usability survey (SUS-05): the mean score against the PRD's target, how the scores spread
// (bars of SUS_BIN_WIDTH, with the target marked), and the average answer to each statement.
// Null while the numbers load: the headings, statements, scale and target are fixed, so they're
// drawn, with placeholders for the numbers and bars.
const props = defineProps<{ sus: AdminStats['sus'] | null }>()

const most = computed(() => Math.max(1, ...(props.sus?.bins.map((bin) => bin.count) ?? [])))
const metTarget = computed(() => {
  const mean = props.sus?.mean ?? null
  return mean !== null && mean >= SUS_TARGET_SCORE
})
const span = SUS_ANSWER_MAX - SUS_ANSWER_MIN

/** Placeholder bar heights, one per bin (the API always sends 100 / SUS_BIN_WIDTH of them). */
const PLACEHOLDER_BINS = Array.from(
  { length: 100 / SUS_BIN_WIDTH },
  (_, i) => [6, 8, 12, 18, 28, 42, 62, 80, 56, 26][i] ?? 20,
)
/** Placeholder widths for the statement averages' bars, as shares of the track. */
const PLACEHOLDER_MEANS = ['78%', '30%', '72%', '38%', '68%', '26%', '80%', '34%', '70%', '42%']
</script>

<template>
  <div class="grid gap-8 lg:grid-cols-2">
    <div>
      <p v-if="!sus" class="flex flex-wrap items-baseline gap-x-3" aria-hidden="true">
        <span class="font-display text-5xl leading-none font-bold">
          <SkeletonText class="w-[1.6em]" />
        </span>
        <span class="text-quiet">mean score, from <SkeletonText class="w-[6.5em]" /></span>
      </p>
      <p v-else class="flex flex-wrap items-baseline gap-x-3">
        <span class="font-display text-5xl leading-none font-bold tabular-nums">
          {{ sus.mean ?? NO_VALUE }}
        </span>
        <span class="text-quiet"
          >mean score, from {{ countText(sus.responses, 'response', 'responses') }}</span
        >
      </p>
      <p v-if="!sus" class="mt-3 flex items-center gap-2 font-semibold" aria-hidden="true">
        <span class="size-5 shrink-0 rounded-full bg-skeleton motion-safe:animate-skeleton" />
        <SkeletonText class="w-[13em]" />
      </p>
      <p
        v-else-if="sus.mean !== null"
        class="mt-3 flex items-center gap-2 font-semibold"
        :class="metTarget ? 'text-evergreen' : 'text-marigold-text'"
      >
        <StrokeIcon :d="metTarget ? ICONS.finished : ICONS.clock" class="size-5" />
        {{ metTarget ? 'At or above' : 'Below' }} the target of {{ SUS_TARGET_SCORE }}
      </p>

      <h3 class="mt-6 font-semibold">How the scores spread</h3>
      <div class="relative mt-8" aria-hidden="true">
        <div class="flex h-36 items-end gap-0.5 border-b border-line-strong/60">
          <template v-if="!sus">
            <div
              v-for="(height, i) in PLACEHOLDER_BINS"
              :key="i"
              class="flex h-full flex-1 flex-col justify-end"
            >
              <span
                class="rounded-t-[4px] bg-skeleton motion-safe:animate-skeleton"
                :style="{ height: `${height}%` }"
              />
            </div>
          </template>
          <div
            v-for="bin in sus?.bins ?? []"
            :key="bin.from"
            class="group relative flex h-full flex-1 flex-col justify-end"
          >
            <span v-if="bin.count" class="mb-1 text-center text-sm font-semibold tabular-nums">{{
              bin.count
            }}</span>
            <span
              class="rounded-t-[4px] bg-evergreen"
              :style="{ height: `${(bin.count / most) * 80}%` }"
            />
            <span
              class="pointer-events-none invisible absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-control bg-ink px-2.5 py-1 text-sm font-semibold whitespace-nowrap text-surface group-hover:visible"
            >
              {{ bin.from }} to {{ bin.to }}: {{ bin.count }}
            </span>
          </div>
        </div>
        <span
          class="absolute -top-6 bottom-0 w-0 border-l-2 border-dashed border-marigold"
          :style="{ left: `${SUS_TARGET_SCORE}%` }"
        >
          <span
            class="absolute -top-0.5 left-1.5 text-sm font-semibold whitespace-nowrap text-marigold-text"
          >
            Target {{ SUS_TARGET_SCORE }}
          </span>
        </span>
        <div class="mt-1 flex justify-between text-sm text-quiet tabular-nums">
          <span v-for="tick in [0, 20, 40, 60, 80, 100]" :key="tick">{{ tick }}</span>
        </div>
      </div>
      <p v-if="sus" class="sr-only">
        Scores by range:
        <template v-for="bin in sus.bins" :key="bin.from"
          >{{ bin.from }} to {{ bin.to }}: {{ bin.count }}.
        </template>
      </p>
    </div>

    <div>
      <h3 class="font-semibold">Average answer to each statement</h3>
      <p class="mt-1 text-sm text-quiet">
        From 1 (Strongly disagree) to 5 (Strongly agree). Odd statements are good things, so higher
        is better; even ones are problems, so lower is better.
      </p>
      <p class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span class="flex items-center gap-2"
          ><span aria-hidden="true" class="size-3 rounded-full bg-evergreen" />Good thing</span
        >
        <span class="flex items-center gap-2"
          ><span aria-hidden="true" class="size-3 rounded-full bg-marigold" />Problem</span
        >
      </p>
      <ol class="mt-4 space-y-3">
        <li v-for="(statement, i) in SUS_STATEMENTS" :key="i">
          <div class="flex items-start justify-between gap-3 text-sm">
            <span class="min-w-0">{{ i + 1 }}. {{ statement }}</span>
            <span v-if="!sus" class="shrink-0 font-semibold" aria-hidden="true">
              <SkeletonText class="w-[2.4em]" />
            </span>
            <span v-else class="shrink-0 font-semibold tabular-nums">
              {{ sus.statementMeans[i]?.toFixed(2) ?? NO_VALUE }}
            </span>
          </div>
          <span class="mt-1.5 block h-2 rounded-[4px] bg-track" aria-hidden="true">
            <span
              v-if="!sus"
              class="block h-full rounded-[4px] bg-line-strong/20 motion-safe:animate-skeleton"
              :style="{ width: PLACEHOLDER_MEANS[i] }"
            />
            <span
              v-else-if="sus.statementMeans[i] != null"
              class="block h-full rounded-[4px]"
              :class="i % 2 === 0 ? 'bg-evergreen' : 'bg-marigold'"
              :style="{
                width: `${Math.max(((sus.statementMeans[i]! - SUS_ANSWER_MIN) / span) * 100, 1)}%`,
              }"
            />
          </span>
        </li>
      </ol>
    </div>
  </div>
</template>
