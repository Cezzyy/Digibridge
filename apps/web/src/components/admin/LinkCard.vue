<script setup lang="ts">
import { LINK_STATUS_LABELS } from '@digibridge/shared'
import { computed, onBeforeUnmount, ref } from 'vue'
import { linkUrl, type SchoolLinkRow } from '../../composables/useSchoolLinks'
import { DANGER_BUTTON, SECONDARY_BUTTON } from '../../lib/buttons'
import { formatDay, lastOpenDay, lockText, responsesText, STATUS_BADGE } from './link-text'

// One school link on the links page: its name, the school it's for, its status, until when it
// stays open, who can use it and how many have started, then its address with Copy and Close.
// Closed and expired links keep their details but lose the buttons.
const props = defineProps<{ link: SchoolLinkRow; isNew?: boolean }>()
const emit = defineEmits<{ close: [] }>()

const url = computed(() => linkUrl(props.link.code))
const canUse = computed(() => props.link.status === 'open' || props.link.status === 'full')

const when = computed(() => {
  const { status, expiresAt, closedAt } = props.link
  if (status === 'closed' && closedAt) return `Closed on ${formatDay(closedAt)}`
  if (status === 'expired') return `Ended after ${lastOpenDay(expiresAt)}`
  return `Open until the end of ${lastOpenDay(expiresAt)}`
})

const copied = ref<'yes' | 'failed' | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
async function copy() {
  try {
    await navigator.clipboard.writeText(url.value)
    copied.value = 'yes'
  } catch {
    copied.value = 'failed'
  }
  clearTimeout(timer)
  timer = setTimeout(() => (copied.value = null), 2500)
}
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <article
    class="rounded-card border bg-surface p-5 sm:p-6"
    :class="isNew ? 'border-evergreen ring-1 ring-evergreen' : 'border-line'"
  >
    <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div class="min-w-0">
        <h3 class="text-xl leading-tight font-bold break-words">{{ link.label }}</h3>
        <p class="mt-1 flex items-center gap-2 text-quiet">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            class="size-5 shrink-0 fill-none stroke-current stroke-[1.75]"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-5h6v5" />
          </svg>
          <span class="sr-only">School:</span>
          <span class="min-w-0 break-words">{{ link.school }}</span>
        </p>
      </div>
      <span
        class="shrink-0 rounded-full px-3 py-1 text-sm font-semibold"
        :class="STATUS_BADGE[link.status]"
      >
        {{ LINK_STATUS_LABELS[link.status] }}
      </span>
    </div>

    <dl class="mt-4 grid gap-3 text-ink sm:grid-cols-3">
      <div>
        <dt class="text-sm font-semibold text-quiet">Expiry</dt>
        <dd>{{ when }}</dd>
      </div>
      <div>
        <dt class="text-sm font-semibold text-quiet">For</dt>
        <dd>{{ lockText(link.course, link.yearLevel) }}</dd>
      </div>
      <div>
        <dt class="text-sm font-semibold text-quiet">Started</dt>
        <dd>{{ responsesText(link.responses, link.maxResponses) }}</dd>
      </div>
    </dl>

    <div
      v-if="canUse"
      class="mt-5 flex flex-col gap-3 border-t border-line pt-5 lg:flex-row lg:items-center"
    >
      <p class="min-w-0 flex-1 truncate rounded-control bg-mist-soft px-3 py-2.5 font-mono text-sm">
        <span class="sr-only">Link: </span>{{ url }}
      </p>
      <div class="flex flex-col gap-3 sm:flex-row">
        <button type="button" :class="SECONDARY_BUTTON" @click="copy">
          {{ copied === 'yes' ? 'Copied' : 'Copy link' }}
        </button>
        <button type="button" :class="DANGER_BUTTON" @click="emit('close')">Close link</button>
      </div>
    </div>
    <p role="status" class="sr-only">{{ copied === 'yes' ? 'Link copied' : '' }}</p>
    <p v-if="copied === 'failed'" role="alert" class="mt-3 font-semibold text-error">
      We couldn’t copy it. Select the link and copy it yourself.
    </p>
  </article>
</template>
