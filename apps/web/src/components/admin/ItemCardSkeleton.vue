<script setup lang="ts">
import { computed } from 'vue'
import SkeletonText from '../results/SkeletonText.vue'

// ItemCard while item analysis loads: the same boxes, padding and type sizes, with placeholders
// where the words and numbers go. Every item has 4 choices, and their letters are fixed, so
// they're shown; the bars are empty tracks. `variant` changes the line widths so a list of them
// doesn't look stamped out. Change it along with ItemCard.
const props = withDefaults(defineProps<{ variant?: number }>(), { variant: 0 })

const LETTERS = ['A', 'B', 'C', 'D']
const SHAPES = [
  { stem: ['w-full', 'w-5/6', 'w-2/5'], choices: ['w-3/5', 'w-2/5', 'w-1/2', 'w-3/4'] },
  { stem: ['w-full', 'w-3/5'], choices: ['w-1/2', 'w-2/3', 'w-2/5', 'w-3/5'] },
  { stem: ['w-full', 'w-full', 'w-1/3'], choices: ['w-2/3', 'w-1/2', 'w-3/4', 'w-2/5'] },
] as const
const shape = computed(() => SHAPES[props.variant % SHAPES.length] ?? SHAPES[0])
</script>

<template>
  <div aria-hidden="true" class="rounded-card border border-line bg-surface p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <p class="text-sm font-semibold"><SkeletonText class="w-[5.5em]" /></p>
      <p class="text-right">
        <span class="block font-display text-2xl font-bold"
          ><SkeletonText class="w-[2.2em]"
        /></span>
        <span class="block text-sm"><SkeletonText class="w-[10em]" /></span>
      </p>
    </div>

    <p class="mt-2">
      <template v-for="(width, i) in shape.stem" :key="i">
        <br v-if="i" />
        <SkeletonText :class="width" />
      </template>
    </p>

    <ul class="mt-4 space-y-2">
      <li v-for="(width, i) in shape.choices" :key="i">
        <div class="flex items-start justify-between gap-3 text-sm">
          <span class="flex min-w-0 flex-1 gap-2">
            <span class="w-4 shrink-0 font-semibold text-quiet">{{ LETTERS[i] }}</span>
            <span class="min-w-0 flex-1"><SkeletonText :class="width" /></span>
          </span>
          <span class="shrink-0 font-semibold"><SkeletonText class="w-[1.5em]" /></span>
        </div>
        <span class="mt-1 ml-6 block h-2 rounded-[4px] bg-track" />
      </li>
    </ul>
  </div>
</template>
