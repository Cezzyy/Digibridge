<script setup lang="ts">
import type { SchoolLinkInput } from '@digibridge/shared'
import { computed, onMounted, ref } from 'vue'
import { ICONS } from '../../components/admin/admin-icons'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import ErrorPanel from '../../components/admin/ErrorPanel.vue'
import LinkCard from '../../components/admin/LinkCard.vue'
import LinkCardSkeleton from '../../components/admin/LinkCardSkeleton.vue'
import LinkForm from '../../components/admin/LinkForm.vue'
import {
  inFilter,
  LINK_FILTER_LABELS,
  LINK_FILTERS,
  type LinkFilter,
} from '../../components/admin/link-text'
import StrokeIcon from '../../components/admin/StrokeIcon.vue'
import SkeletonText from '../../components/results/SkeletonText.vue'
import { useSchoolLinks, type SchoolLinkRow } from '../../composables/useSchoolLinks'
import { PRIMARY_BUTTON } from '../../lib/buttons'

// School links (LNK-01), admin only: make a link for a class, copy it to send to the students,
// see each link's school, expiry, status and how many have joined, and close it. With no links
// yet, the form is already open. While the list loads, the filter and three LinkCardSkeletons
// stand in for it, in the same places.
const { links, loadError, load, creating, createError, create, closingId, closeError, close } =
  useSchoolLinks()
onMounted(load)

const filter = ref<LinkFilter>('all')
const formOpen = ref(false)
const showForm = computed(() => formOpen.value || links.value?.length === 0)
/** The school of the last link made, filled in on the next form. */
const lastSchool = ref('')

/** The link just made, outlined in the list until another is made. */
const newId = ref<string | null>(null)

async function submit(input: SchoolLinkInput) {
  const link = await create(input)
  if (!link) return
  newId.value = link.id
  lastSchool.value = input.school
  formOpen.value = false
  // A new link is open, so make sure the list shows it.
  if (!inFilter(link.status, filter.value)) filter.value = 'all'
}

const counts = computed(() => {
  const list = links.value
  if (!list) return null
  return Object.fromEntries(
    LINK_FILTERS.map((f) => [f, list.filter((link) => inFilter(link.status, f)).length]),
  ) as Record<LinkFilter, number>
})
const shown = computed(() => links.value?.filter((link) => inFilter(link.status, filter.value)))

// Closing asks first: new students can't join through the link after that.
const closing = ref<SchoolLinkRow | null>(null)
async function confirmClose() {
  if (closing.value && (await close(closing.value.id))) closing.value = null
}
const newLabel = computed(() => links.value?.find((link) => link.id === newId.value)?.label)

// A failed create or close shouldn't still show the next time the form or dialog opens.
function cancelForm() {
  formOpen.value = false
  createError.value = null
}
function stopClosing() {
  closing.value = null
  closeError.value = null
}
</script>

<template>
  <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 class="text-3xl leading-tight font-bold sm:text-4xl">School links</h1>
      <p class="mt-2 max-w-2xl text-lg text-quiet">
        Make a link for a class, then send it only to the students you choose. They open it on their
        own phone or laptop, without signing in.
      </p>
    </div>
    <!-- Shown while the list loads too (only a first, empty list opens the form instead). -->
    <button
      v-if="!showForm"
      type="button"
      :class="PRIMARY_BUTTON"
      class="shrink-0 self-start sm:self-auto"
      :disabled="!links"
      @click="formOpen = true"
    >
      <StrokeIcon :d="ICONS.plus" class="size-5" />
      New link
    </button>
  </div>

  <LinkForm
    v-if="showForm"
    class="mt-8"
    :school="lastSchool"
    :creating="creating"
    :error="createError"
    :cancellable="(links?.length ?? 0) > 0"
    @submit="submit"
    @cancel="cancelForm"
  />

  <p
    v-if="newLabel && !showForm"
    role="status"
    class="mt-8 flex items-center gap-3 rounded-card bg-evergreen-soft p-4 font-semibold text-evergreen"
  >
    <StrokeIcon :d="ICONS.finished" class="size-6" />
    The link for {{ newLabel }} is ready. Copy it below and send it to the students.
  </p>

  <section aria-labelledby="links-heading" class="mt-10">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 id="links-heading" class="text-xl font-bold">Your links</h2>

      <div
        v-if="!loadError && links?.length !== 0"
        role="group"
        aria-label="Show"
        class="flex flex-wrap gap-1 rounded-card border border-line bg-surface p-1"
      >
        <button
          v-for="f in LINK_FILTERS"
          :key="f"
          type="button"
          :aria-pressed="filter === f"
          :disabled="!counts"
          class="flex min-h-11 items-center gap-2 rounded-control px-3 font-semibold text-quiet transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-evergreen disabled:cursor-wait aria-pressed:bg-evergreen-soft aria-pressed:text-evergreen"
          @click="filter = f"
        >
          {{ LINK_FILTER_LABELS[f] }}
          <span class="rounded-full bg-mist-soft px-2 text-sm text-quiet tabular-nums">
            <template v-if="counts">{{ counts[f] }}</template>
            <SkeletonText v-else tone="soft" class="w-[1ch]" />
          </span>
        </button>
      </div>
    </div>

    <ErrorPanel v-if="loadError" class="mt-4" :message="loadError" @retry="load" />

    <ul v-else-if="!links" class="mt-4 space-y-4" aria-busy="true">
      <li v-for="n in 3" :key="n"><LinkCardSkeleton /></li>
      <li class="sr-only">Loading your links</li>
    </ul>

    <div
      v-else-if="links.length === 0"
      class="mt-4 flex items-center gap-4 rounded-card border border-dashed border-line-strong/60 p-5 text-quiet"
    >
      <StrokeIcon :d="ICONS.link" class="size-6" />
      <p>No school links yet. Make the first one above.</p>
    </div>

    <p v-else-if="shown?.length === 0" class="mt-4 rounded-card bg-mist-soft p-5 text-quiet">
      No {{ LINK_FILTER_LABELS[filter].toLowerCase() }} links.
      <button
        type="button"
        class="font-semibold text-evergreen underline underline-offset-2"
        @click="filter = 'all'"
      >
        Show all
      </button>
    </p>

    <ul v-else class="mt-4 space-y-4">
      <li v-for="link in shown" :key="link.id">
        <LinkCard :link="link" :is-new="link.id === newId" @close="closing = link" />
      </li>
    </ul>
  </section>

  <ConfirmDialog
    :open="closing !== null"
    :title="`Close ${closing?.label ?? 'this link'}?`"
    message="New students won’t be able to join through it. Students who already saved their profile can still take the assessment and finish it. You can’t open it again, but you can make a new link."
    confirm-label="Close link"
    busy-label="Closing…"
    :busy="closingId !== null"
    :error="closeError"
    @confirm="confirmClose"
    @close="stopClosing"
  />
</template>
