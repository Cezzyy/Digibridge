<script setup lang="ts">
import { useSchoolLinkStore } from '../../stores/schoolLink'

// On a school-link page, the link the student opened ("BSIT 2A · ACLC College of Mandaue"), so
// they can tell it's the one their school sent. Made for StartLayout's green panel; shows
// nothing online.
const school = useSchoolLinkStore()
</script>

<template>
  <p
    v-if="school.active && school.link"
    class="mb-6 inline-flex max-w-full items-center gap-2 self-start rounded-full bg-white/10 px-3 py-1 text-sm font-semibold ring-1 ring-white/20 ring-inset"
  >
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      class="size-4 shrink-0 fill-none stroke-marigold stroke-2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M3 9.5 12 5l9 4.5-9 4.5-9-4.5Z" />
      <path d="M7 11.5v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4" />
    </svg>
    <span class="min-w-0 truncate">
      {{ school.link.label
      }}<span class="font-normal text-white/80"> · {{ school.link.school }}</span>
    </span>
  </p>
</template>
