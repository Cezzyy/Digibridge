<script setup lang="ts">
import { LINK_STATUS_LABELS, type LinkStatus } from '@digibridge/shared'
import { STATUS_BADGE, STATUS_DOT } from './link-text'

// A school link's status as a pill with a colored dot: open, full, expired or closed.
defineProps<{ status: LinkStatus }>()
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold"
    :class="STATUS_BADGE[status]"
  >
    <span aria-hidden="true" class="size-2 rounded-full" :class="STATUS_DOT[status]" />
    {{ LINK_STATUS_LABELS[status] }}
  </span>
</template>
