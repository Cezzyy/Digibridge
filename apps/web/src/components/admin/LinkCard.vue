<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { linkUrl, type SchoolLinkRow } from '../../composables/useSchoolLinks'
import { DANGER_BUTTON, SECONDARY_BUTTON } from '../../lib/buttons'
import { ICONS } from './admin-icons'
import { formatDay, lastOpenDay, lockText, responsesText } from './link-text'
import LinkStatusBadge from './LinkStatusBadge.vue'
import StrokeIcon from './StrokeIcon.vue'

// One school link on the links page: its name, school, who made it and when, its status, its
// last day, who can use it and how many have joined (with a bar when there's a limit), then
// its address with Copy and Close. Closed and expired links keep their details but lose the
// address bar. LinkCardSkeleton draws the same layout while the list loads: change both together.
const props = defineProps<{ link: SchoolLinkRow; isNew?: boolean }>()
const emit = defineEmits<{ close: [] }>()

const url = computed(() => linkUrl(props.link.code))
const canUse = computed(() => props.link.status === 'open' || props.link.status === 'full')

const made = computed(() => {
  const { createdBy, createdAt } = props.link
  return createdBy
    ? `Made by ${createdBy} on ${formatDay(createdAt)}`
    : `Made on ${formatDay(createdAt)}`
})

const day = computed(() => {
  const { status, expiresAt, closedAt } = props.link
  if (status === 'closed' && closedAt) return { label: 'Closed on', value: formatDay(closedAt) }
  return { label: 'Last day open', value: lastOpenDay(expiresAt) }
})

/** How full the link is, 0 to 100, or null with no limit. */
const fill = computed(() => {
  const { responses, maxResponses } = props.link
  if (!maxResponses) return null
  return Math.min(100, (responses / maxResponses) * 100)
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

const ICON_TILE =
  'absolute top-0.5 left-0 grid size-9 place-items-center rounded-control bg-mist-soft text-quiet'
</script>

<template>
  <article
    class="overflow-hidden rounded-card border bg-surface transition-shadow"
    :class="isNew ? 'border-evergreen ring-1 ring-evergreen' : 'border-line'"
  >
    <div class="p-5 sm:p-6">
      <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div class="min-w-0">
          <h3 class="text-xl leading-tight font-bold break-words">{{ link.label }}</h3>
          <p class="mt-1 flex items-center gap-2 text-quiet">
            <StrokeIcon :d="ICONS.school" class="size-5" />
            <span class="sr-only">School:</span>
            <span class="min-w-0 break-words">{{ link.school }}</span>
          </p>
          <p class="mt-1 text-sm text-quiet">{{ made }}</p>
        </div>
        <LinkStatusBadge :status="link.status" />
      </div>

      <dl class="mt-5 grid gap-4 sm:grid-cols-3">
        <div class="relative min-w-0 pl-12">
          <dt class="text-sm font-semibold text-quiet">
            <span aria-hidden="true" :class="ICON_TILE">
              <StrokeIcon :d="ICONS.calendar" class="size-5" />
            </span>
            {{ day.label }}
          </dt>
          <dd class="truncate">{{ day.value }}</dd>
        </div>
        <div class="relative min-w-0 pl-12">
          <dt class="text-sm font-semibold text-quiet">
            <span aria-hidden="true" :class="ICON_TILE">
              <StrokeIcon :d="ICONS.cap" class="size-5" />
            </span>
            For
          </dt>
          <dd class="truncate">{{ lockText(link.course, link.yearLevel) }}</dd>
        </div>
        <div class="relative min-w-0 pl-12">
          <dt class="text-sm font-semibold text-quiet">
            <span aria-hidden="true" :class="ICON_TILE">
              <StrokeIcon :d="ICONS.started" class="size-5" />
            </span>
            Joined
          </dt>
          <dd class="truncate">{{ responsesText(link.responses, link.maxResponses) }}</dd>
          <!-- The bar's row is kept with no limit too, so every card (and the skeleton) lines up. -->
          <dd aria-hidden="true" class="mt-2 h-1.5 overflow-hidden rounded-full bg-track">
            <span
              v-if="fill !== null"
              class="block h-full rounded-full"
              :class="link.status === 'full' ? 'bg-marigold' : 'bg-evergreen'"
              :style="{ width: `${fill}%` }"
            />
          </dd>
        </div>
      </dl>
    </div>

    <div
      v-if="canUse"
      class="flex flex-col gap-3 border-t border-line bg-mist-soft px-5 py-4 sm:px-6 lg:flex-row lg:items-center"
    >
      <p
        class="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-control border border-line bg-surface px-3 font-mono text-sm"
      >
        <StrokeIcon :d="ICONS.link" class="size-4 text-quiet" />
        <span class="sr-only">Link: </span>
        <span class="min-w-0 truncate">{{ url }}</span>
      </p>
      <div class="flex flex-col gap-3 sm:flex-row">
        <button type="button" :class="SECONDARY_BUTTON" class="bg-surface" @click="copy">
          <StrokeIcon :d="copied === 'yes' ? ICONS.check : ICONS.copy" class="size-5" />
          <!-- Both words take the same room, so the button keeps its width. -->
          <span class="grid">
            <span class="col-start-1 row-start-1" :class="{ invisible: copied === 'yes' }">
              Copy link
            </span>
            <span class="col-start-1 row-start-1" :class="{ invisible: copied !== 'yes' }">
              Copied
            </span>
          </span>
        </button>
        <button type="button" :class="DANGER_BUTTON" class="bg-surface" @click="emit('close')">
          <StrokeIcon :d="ICONS.close" class="size-5" />
          Close link
        </button>
      </div>
    </div>
    <p role="status" class="sr-only">{{ copied === 'yes' ? 'Link copied' : '' }}</p>
    <p
      v-if="copied === 'failed'"
      role="alert"
      class="border-t border-line bg-error-soft px-5 py-3 font-semibold text-error sm:px-6"
    >
      We couldn’t copy it. Select the link and copy it yourself.
    </p>
  </article>
</template>
