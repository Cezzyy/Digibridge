<script setup lang="ts">
import { LESSON_TIER_LABELS, type LessonTier } from '@digibridge/shared'
import SkeletonText from '../results/SkeletonText.vue'
import TierMeter from './TierMeter.vue'

// Shaped like a LessonTile while the lessons load. The tier is known, so it's shown; the title,
// summary and levels are placeholders.
defineProps<{ tier: LessonTier }>()
</script>

<template>
  <div
    aria-hidden="true"
    class="flex h-full flex-col rounded-card border border-line bg-surface p-5 sm:p-6"
  >
    <p class="flex items-center justify-between text-sm font-semibold">
      <span class="text-evergreen">{{ LESSON_TIER_LABELS[tier] }}</span>
      <TierMeter :tier="tier" class="opacity-40" />
    </p>
    <p class="mt-4 text-xl leading-tight font-bold">
      <SkeletonText class="w-full" />
      <br />
      <SkeletonText class="w-1/2" />
    </p>
    <p class="mt-2 leading-relaxed">
      <SkeletonText class="w-full" />
      <br />
      <SkeletonText class="w-2/3" />
    </p>
    <p class="mt-auto pt-5">
      <span class="block border-t border-line pt-4 text-sm">
        <SkeletonText class="w-[9em]" />
      </span>
    </p>
  </div>
</template>
