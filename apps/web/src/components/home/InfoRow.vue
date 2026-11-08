<script setup lang="ts">
import type { ChoiceIcon } from '../start/choice-icons'

// One row of a panel split by lines, like the privacy notice's: an icon and the title on the
// left, what it says on the right. Phones stack them, and so do laptops, where StartLayout's
// green panel leaves the content less room.
defineProps<{ title: string; icon: ChoiceIcon }>()
</script>

<template>
  <li
    class="gap-8 px-5 py-6 sm:px-7 md:grid md:grid-cols-[14rem_minmax(0,1fr)] lg:grid-cols-1 xl:grid-cols-[16rem_minmax(0,1fr)] xl:py-7 2xl:grid-cols-[18rem_minmax(0,1fr)]"
  >
    <div class="flex items-center gap-3 md:items-start lg:items-center xl:items-start">
      <span
        aria-hidden="true"
        class="grid size-10 shrink-0 place-items-center rounded-control bg-evergreen-soft text-evergreen"
      >
        <svg
          viewBox="0 0 24 24"
          class="size-6 fill-none stroke-current stroke-[1.75]"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path v-for="d in icon" :key="d" :d="d" />
        </svg>
      </span>
      <h3 class="text-lg leading-snug font-bold md:pt-2 lg:pt-0 xl:pt-2">{{ title }}</h3>
    </div>
    <div class="mt-4 md:mt-0 lg:mt-4 xl:mt-0">
      <slot />
    </div>
  </li>
</template>
