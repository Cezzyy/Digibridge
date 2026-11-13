<script setup lang="ts">
import { DANGER_BUTTON, SECONDARY_BUTTON } from '../../lib/buttons'
import SkeletonText from '../results/SkeletonText.vue'

// LinkCard while the links load: the same boxes, padding and type sizes, with placeholders
// where the words go, drawn as an open link (the address bar showing). The badge and buttons
// keep their real words, hidden, so they take the same room. Change it along with LinkCard.
const BLOCK = 'bg-skeleton motion-safe:animate-skeleton'
const ICON_TILE = `absolute top-0.5 left-0 size-9 rounded-control ${BLOCK}`
const HIDDEN_BUTTON = 'border-transparent! text-transparent!'
</script>

<template>
  <div aria-hidden="true" class="overflow-hidden rounded-card border border-line bg-surface">
    <div class="p-5 sm:p-6">
      <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div class="min-w-0">
          <p class="font-display text-xl leading-tight font-bold"><SkeletonText class="w-36" /></p>
          <p class="mt-1 flex items-center gap-2">
            <span class="size-5 shrink-0 rounded" :class="BLOCK" />
            <SkeletonText class="w-48" />
          </p>
          <p class="mt-1 text-sm"><SkeletonText class="w-56" /></p>
        </div>
        <span
          class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold text-transparent"
          :class="BLOCK"
        >
          <span class="size-2" />
          Open
        </span>
      </div>

      <div class="mt-5 grid gap-4 sm:grid-cols-3">
        <div v-for="(width, i) in ['w-28', 'w-36', 'w-32']" :key="width" class="relative pl-12">
          <span :class="ICON_TILE" />
          <p class="text-sm font-semibold"><SkeletonText class="w-20" /></p>
          <p><SkeletonText :class="width" /></p>
          <!-- Joined's bar row. -->
          <p v-if="i === 2" class="mt-2 h-1.5 rounded-full" :class="BLOCK" />
        </div>
      </div>
    </div>

    <div
      class="flex flex-col gap-3 border-t border-line bg-mist-soft px-5 py-4 sm:px-6 lg:flex-row lg:items-center"
    >
      <p
        class="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-control border border-line bg-surface px-3 font-mono text-sm"
      >
        <span class="size-4 shrink-0 rounded-sm" :class="BLOCK" />
        <SkeletonText class="w-64" />
      </p>
      <div class="flex flex-col gap-3 sm:flex-row">
        <span :class="[SECONDARY_BUTTON, BLOCK, HIDDEN_BUTTON]">
          <span class="size-5" />
          Copy link
        </span>
        <span :class="[SECONDARY_BUTTON, BLOCK, HIDDEN_BUTTON]">
          <span class="size-5" />
          Preview
        </span>
        <span :class="[DANGER_BUTTON, BLOCK, HIDDEN_BUTTON]">
          <span class="size-5" />
          Close link
        </span>
      </div>
    </div>
  </div>
</template>
