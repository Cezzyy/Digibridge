<script setup lang="ts">
import {
  AREA_CODES,
  AREA_LABELS,
  LESSON_TIER_LABELS,
  LESSON_TIERS,
  type AreaCode,
  type LessonTier,
} from '@digibridge/shared'
import { computed, onMounted, ref } from 'vue'
import { ICONS } from '../../components/admin/admin-icons'
import ErrorPanel from '../../components/admin/ErrorPanel.vue'
import LessonStatusBadge from '../../components/admin/LessonStatusBadge.vue'
import { areaNumber, formatEdited } from '../../components/admin/lesson-text'
import StrokeIcon from '../../components/admin/StrokeIcon.vue'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import LevelDots from '../../components/lessons/LevelDots.vue'
import TierMeter from '../../components/lessons/TierMeter.vue'
import SkeletonText from '../../components/results/SkeletonText.vue'
import { useAdminLessons, type AdminLessonRow } from '../../composables/useAdminLessons'
import { PRIMARY_BUTTON } from '../../lib/buttons'

// The lessons editor's list (CMS-04), admin only: the 9 places in the library, 3 areas × 3
// tiers (LES-01), each with the lesson students see there and any drafts. A draft can be
// deleted; a published lesson has to be unpublished in the editor first, so the library never
// loses a lesson by accident. While the list loads, the areas and tiers are drawn already, with
// placeholders where the lessons go.
const { lessons, loadError, load, deletingId, deleteError, remove } = useAdminLessons()
onMounted(load)

type Slot = {
  tier: LessonTier
  /** The published lesson first, then the drafts, newest edit first (the API's order). */
  rows: AdminLessonRow[]
}

const inSlot = (lesson: AdminLessonRow, area: AreaCode, tier: LessonTier) =>
  lesson.area === area && lesson.tier === tier

const areas = computed(() =>
  AREA_CODES.map((code) => ({
    code,
    number: areaNumber(code),
    label: AREA_LABELS[code],
    slots: LESSON_TIERS.map<Slot>((tier) => {
      const rows = (lessons.value ?? []).filter((lesson) => inSlot(lesson, code, tier))
      return { tier, rows }
    }),
  })),
)

const SLOT_COUNT = AREA_CODES.length * LESSON_TIERS.length
const publishedCount = computed(() => lessons.value?.filter((l) => l.isPublished).length ?? 0)

// Deleting asks first: a draft can't be brought back.
const deleting = ref<AdminLessonRow | null>(null)
async function confirmDelete() {
  if (deleting.value && (await remove(deleting.value.id))) deleting.value = null
}
function stopDeleting() {
  deleting.value = null
  deleteError.value = null
}

const newLessonLink = (area?: AreaCode, tier?: LessonTier) => ({
  name: 'admin-lesson-new',
  query: area && tier ? { area, tier } : {},
})
</script>

<template>
  <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 class="text-3xl leading-tight font-bold sm:text-4xl">Lessons</h1>
      <p class="mt-2 max-w-2xl text-lg text-quiet">
        Write the lessons students get after their results: one for each area and level. Students
        only see published lessons. Drafts stay here until you publish them.
      </p>
    </div>
    <RouterLink :to="newLessonLink()" :class="PRIMARY_BUTTON" class="shrink-0 self-start">
      <StrokeIcon :d="ICONS.plus" class="size-5" />
      New lesson
    </RouterLink>
  </div>

  <ErrorPanel v-if="loadError" class="mt-8" :message="loadError" @retry="load" />

  <template v-else>
    <div class="mt-8 rounded-card border border-line bg-surface p-5 sm:p-6">
      <p class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <span class="font-semibold">Published in the library</span>
        <span class="font-display text-2xl font-bold tabular-nums">
          <template v-if="lessons">{{ publishedCount }}</template>
          <SkeletonText v-else class="w-[1ch]" />
          <span class="text-base font-semibold text-quiet"> of {{ SLOT_COUNT }}</span>
        </span>
      </p>
      <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
        <div
          class="h-full rounded-full bg-evergreen transition-[width] duration-500 ease-glide"
          :style="{ width: `${(publishedCount / SLOT_COUNT) * 100}%` }"
        />
      </div>
      <p class="mt-3 text-sm text-quiet">
        A level with no published lesson shows Coming soon on the results page.
      </p>
    </div>

    <p v-if="!lessons" class="sr-only" role="status">Loading the lessons</p>

    <section
      v-for="area in areas"
      :key="area.code"
      :aria-labelledby="`area-${area.code}-heading`"
      class="mt-10"
    >
      <h2 :id="`area-${area.code}-heading`" class="flex items-baseline gap-3 text-xl font-bold">
        <span class="font-display text-marigold-text tabular-nums">{{ area.number }}</span>
        {{ area.label }}
      </h2>

      <ul class="mt-4 grid gap-4 xl:grid-cols-3">
        <li
          v-for="slot in area.slots"
          :key="slot.tier"
          class="flex flex-col rounded-card border border-line bg-surface"
        >
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-line p-4">
            <h3 class="flex items-center gap-2.5 font-semibold">
              <TierMeter :tier="slot.tier" />
              {{ LESSON_TIER_LABELS[slot.tier] }}
            </h3>
            <LevelDots :tier="slot.tier" class="text-sm text-quiet" />
          </div>

          <!-- Placeholders the size of one lesson while the list loads. -->
          <div v-if="!lessons" aria-hidden="true" class="flex-1 p-4">
            <p class="font-semibold"><SkeletonText class="w-4/5" /></p>
            <p class="mt-1 text-sm"><SkeletonText class="w-[12em]" /></p>
          </div>

          <ul v-else class="flex-1 divide-y divide-line">
            <li v-for="lesson in slot.rows" :key="lesson.id" class="p-4">
              <div class="flex items-start justify-between gap-3">
                <RouterLink
                  :to="{ name: 'admin-lesson', params: { id: lesson.id } }"
                  class="min-w-0 leading-snug font-semibold text-evergreen hover:underline"
                >
                  {{ lesson.title }}
                </RouterLink>
                <LessonStatusBadge :published="lesson.isPublished" />
              </div>
              <p class="mt-1 text-sm text-quiet">Edited {{ formatEdited(lesson.updatedAt) }}</p>
              <div class="mt-2 flex flex-wrap gap-x-4 text-sm font-semibold">
                <RouterLink
                  :to="{ name: 'admin-lesson', params: { id: lesson.id } }"
                  class="inline-flex min-h-11 items-center text-evergreen hover:underline"
                >
                  Edit<span class="sr-only">&nbsp;{{ lesson.title }}</span>
                </RouterLink>
                <a
                  v-if="lesson.isPublished"
                  :href="`/lessons/${lesson.slug}`"
                  target="_blank"
                  rel="noopener"
                  class="inline-flex min-h-11 items-center text-evergreen hover:underline"
                >
                  See it as students do<span class="sr-only">&nbsp;(opens in a new tab)</span>
                </a>
                <button
                  v-else
                  type="button"
                  class="inline-flex min-h-11 items-center text-error hover:underline disabled:cursor-wait"
                  :disabled="deletingId === lesson.id"
                  @click="deleting = lesson"
                >
                  Delete<span class="sr-only">&nbsp;{{ lesson.title }}</span>
                </button>
              </div>
            </li>

            <li v-if="slot.rows.length === 0" class="p-4 text-quiet">
              No lesson yet. Students see Coming soon here.
            </li>
          </ul>

          <div v-if="lessons" class="border-t border-line px-4 py-1">
            <RouterLink
              :to="newLessonLink(area.code, slot.tier)"
              class="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-evergreen hover:underline"
            >
              <StrokeIcon :d="ICONS.plus" class="size-4" />
              {{ slot.rows.length ? 'Add a draft' : 'Write this lesson' }}
              <span class="sr-only">
                for {{ area.label }}, {{ LESSON_TIER_LABELS[slot.tier] }}
              </span>
            </RouterLink>
          </div>
        </li>
      </ul>
    </section>
  </template>

  <ConfirmDialog
    :open="deleting !== null"
    :title="`Delete ${deleting?.title ?? 'this draft'}?`"
    message="The draft and everything in it will be gone for good. Students never saw it, so nothing changes for them."
    confirm-label="Delete draft"
    busy-label="Deleting…"
    :busy="deletingId !== null"
    :error="deleteError"
    @confirm="confirmDelete"
    @close="stopDeleting"
  />
</template>
