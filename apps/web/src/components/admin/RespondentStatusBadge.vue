<script setup lang="ts">
import { RESPONDENT_STATUS_LABELS, type RespondentStatus } from '@digibridge/shared'
import { RESPONDENT_STATUS_BADGE, RESPONDENT_STATUS_DOT } from './respondent-text'

// Where a respondent is, as a pill with a colored dot: not started, in progress, finished, voided.
defineProps<{ status: RespondentStatus }>()
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap"
    :class="RESPONDENT_STATUS_BADGE[status]"
  >
    <span aria-hidden="true" class="size-2 rounded-full" :class="RESPONDENT_STATUS_DOT[status]" />
    {{ RESPONDENT_STATUS_LABELS[status] }}
  </span>
</template>
