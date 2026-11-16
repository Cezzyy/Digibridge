<script setup lang="ts">
import { EXPORT_FORMAT_LABELS, EXPORT_FORMATS } from '@digibridge/shared'
import { computed } from 'vue'
import { useExport } from '../../composables/useExport'
import { SECONDARY_BUTTON } from '../../lib/buttons'
import { ICONS } from './admin-icons'
import StrokeIcon from './StrokeIcon.vue'

// Downloads the respondents the table shows (DSH-06), admin only: its filters, status, search
// and sort, every page. CSV for any tool; Excel adds a sheet of the questions and a codebook.
const props = defineProps<{
  /** The table's query, without the page. */
  query: Record<string, string>
  /** How many match, once the table has loaded. */
  total: number | null
}>()
const { busy, error, download } = useExport()

const note = computed(() => {
  if (props.total === null) return 'Every page of the respondents below, in the same order.'
  const who = props.total === 1 ? 'respondent' : 'respondents'
  return `All ${props.total} ${who} below, every page, in the same order.`
})
</script>

<template>
  <!-- shrink-0 keeps both buttons on one row beside the page intro; the note's w-0 min-w-full
       wraps it to the buttons' width instead of letting it widen the column. -->
  <div class="flex shrink-0 flex-col gap-2 sm:items-end">
    <div role="group" aria-label="Download respondents" class="flex flex-wrap gap-2 sm:flex-nowrap">
      <button
        v-for="format in EXPORT_FORMATS"
        :key="format"
        type="button"
        :class="SECONDARY_BUTTON"
        :disabled="busy !== null"
        :aria-busy="busy === format"
        @click="download(format, query)"
      >
        <StrokeIcon :d="ICONS.download" class="size-5" />
        {{ busy === format ? 'Preparing…' : `Download ${EXPORT_FORMAT_LABELS[format]}` }}
      </button>
    </div>
    <p v-if="error" role="alert" class="font-semibold text-error sm:w-0 sm:min-w-full">
      {{ error }}
    </p>
    <p v-else class="text-quiet sm:w-0 sm:min-w-full">{{ note }}</p>
  </div>
</template>
