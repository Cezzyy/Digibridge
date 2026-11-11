<script setup lang="ts">
import { computed, useId } from 'vue'
import SkeletonText from '../results/SkeletonText.vue'

// A count split into parts, on the admin overview: one bar with a colored piece per part, and
// a key with each part's count and share. Parts with no `value` yet draw the same card with
// placeholders, so nothing moves when the counts come in.
export type SplitPart = {
  label: string
  value: number | undefined
  /** The part's color: `evergreen` or `marigold`. */
  tone: 'evergreen' | 'marigold'
}

const props = defineProps<{ title: string; description: string; parts: SplitPart[] }>()

const TONE = { evergreen: 'bg-evergreen', marigold: 'bg-marigold' } as const

const loaded = computed(() => props.parts.every((part) => part.value !== undefined))
const total = computed(() => props.parts.reduce((sum, part) => sum + (part.value ?? 0), 0))

/** Whole percentages that add up to 100: the largest remainders get the leftover points. */
const shares = computed(() => {
  const values = props.parts.map((part) => part.value ?? 0)
  if (total.value === 0) return values.map(() => 0)
  const raw = values.map((value) => (value * 100) / total.value)
  const whole = raw.map(Math.floor)
  const left = 100 - whole.reduce((sum, n) => sum + n, 0)
  const byRemainder = raw
    .map((_, i) => i)
    .sort((a, b) => raw[b]! - whole[b]! - (raw[a]! - whole[a]!))
  for (const i of byRemainder.slice(0, left)) whole[i]!++
  return whole
})

const id = useId()
</script>

<template>
  <section
    :aria-labelledby="`${id}-title`"
    :aria-busy="!loaded"
    class="flex flex-col rounded-card border border-line bg-surface p-5 sm:p-6"
  >
    <h2 :id="`${id}-title`" class="text-lg leading-tight font-bold">{{ title }}</h2>
    <p class="mt-1 text-quiet">{{ description }}</p>

    <div
      aria-hidden="true"
      class="mt-5 flex h-3 gap-0.5 overflow-hidden rounded-full bg-track"
      :class="{ 'motion-safe:animate-skeleton': !loaded }"
    >
      <template v-if="loaded">
        <span
          v-for="(part, i) in parts"
          v-show="shares[i]! > 0"
          :key="part.label"
          class="h-full transition-[width] duration-700 ease-glide"
          :class="TONE[part.tone]"
          :style="{ width: `${shares[i]}%` }"
        />
      </template>
    </div>

    <ul class="mt-4 grid gap-2">
      <li v-for="(part, i) in parts" :key="part.label" class="flex items-center gap-3">
        <span aria-hidden="true" class="size-2.5 shrink-0 rounded-full" :class="TONE[part.tone]" />
        <span class="min-w-0 flex-1 truncate text-quiet">{{ part.label }}</span>
        <span class="font-semibold tabular-nums">
          <template v-if="part.value !== undefined">
            {{ part.value.toLocaleString('en-US') }}
            <span class="font-normal text-quiet">· {{ shares[i] }}%</span>
          </template>
          <SkeletonText v-else class="w-16" />
        </span>
      </li>
    </ul>
  </section>
</template>
