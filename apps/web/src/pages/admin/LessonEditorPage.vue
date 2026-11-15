<script setup lang="ts">
import {
  AREA_LABELS,
  areaCodeSchema,
  LESSON_TIER_LABELS,
  lessonTierSchema,
  type LessonInput,
} from '@digibridge/shared'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ICONS } from '../../components/admin/admin-icons'
import ErrorPanel from '../../components/admin/ErrorPanel.vue'
import LessonForm from '../../components/admin/LessonForm.vue'
import LessonStatusBadge from '../../components/admin/LessonStatusBadge.vue'
import { formatEdited } from '../../components/admin/lesson-text'
import StrokeIcon from '../../components/admin/StrokeIcon.vue'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import SkeletonText from '../../components/results/SkeletonText.vue'
import { useAdminLessons, type AdminLessonRow } from '../../composables/useAdminLessons'
import { useLessonEditor } from '../../composables/useLessonEditor'
import { PRIMARY_BUTTON } from '../../lib/buttons'

// One lesson in the lessons editor (CMS-04), admin only: /admin/lessons/new for a new one
// (`?area=&tier=` from the list picks its place), /admin/lessons/:id for a saved one. The form
// and its preview are in LessonForm; this page loads and saves, and asks first when publishing
// would replace the lesson students see in that place, or unpublishing would leave it empty
// (LES-01). After a new lesson's first save, the address becomes its own. Leaving with unsaved
// changes asks first too, inside the app and when closing the tab.
const route = useRoute()
const router = useRouter()
const { lesson, notFound, loadError, load, saving, saveError, save } = useLessonEditor()
const { lessons, load: loadLessons } = useAdminLessons()
onMounted(loadLessons)

/** The saved lesson's ID, or null on /admin/lessons/new. */
const id = computed(() => (route.name === 'admin-lesson' ? String(route.params.id) : null))
// The same page shows /new and /:id, so a new lesson's first save stays on it: no reload then.
watch(
  id,
  (value) => {
    if (value && value !== lesson.value?.id) void load(value)
    if (!value) lesson.value = null
  },
  { immediate: true },
)
const reload = () => id.value && load(id.value)

const start = computed(() => ({
  area: areaCodeSchema.safeParse(route.query.area).data,
  tier: lessonTierSchema.safeParse(route.query.tier).data,
}))

const loading = computed(
  () => id.value !== null && !lesson.value && !notFound.value && !loadError.value,
)
const heading = computed(() => (id.value ? (lesson.value?.title ?? null) : 'New lesson'))

// ---- Saving ----

const dirty = ref(false)
const notice = ref<string | null>(null)

type Pending =
  | { kind: 'replace'; input: LessonInput; replaces: AdminLessonRow }
  | { kind: 'unpublish'; input: LessonInput }
const pending = ref<Pending | null>(null)

function onSave(input: LessonInput, replaces: AdminLessonRow | null) {
  notice.value = null
  saveError.value = null
  if (replaces) pending.value = { kind: 'replace', input, replaces }
  else if (lesson.value?.isPublished && !input.isPublished) {
    pending.value = { kind: 'unpublish', input }
  } else void commit(input)
}

async function commit(input: LessonInput) {
  const wasPublished = lesson.value?.isPublished ?? false
  const saved = await save(input, id.value ?? undefined)
  if (!saved) return
  pending.value = null
  // The form starts again from the saved lesson, so nothing is unsaved now.
  dirty.value = false
  notice.value =
    saved.isPublished && !wasPublished
      ? 'Published. Students can open it now.'
      : !saved.isPublished && wasPublished
        ? 'Unpublished. It’s a draft again.'
        : 'Saved.'
  // What's published where may have changed, for the next publish.
  void loadLessons()
  if (!id.value) await router.replace({ name: 'admin-lesson', params: { id: saved.id } })
}

function stopPending() {
  pending.value = null
  saveError.value = null
}

const confirm = computed(() => {
  const p = pending.value
  if (p?.kind === 'replace') {
    return {
      title: `Publish in place of ${p.replaces.title}?`,
      message: `Students will get this lesson for ${AREA_LABELS[p.input.area]}, ${LESSON_TIER_LABELS[p.input.tier]} from now on. ${p.replaces.title} goes back to being a draft, so you can publish it again later.`,
      confirmLabel: 'Publish',
      busyLabel: 'Publishing…',
    }
  }
  return {
    title: 'Unpublish this lesson?',
    message:
      'Students won’t be able to open it, and their results will show Coming soon for this area and level until another lesson is published. It stays here as a draft.',
    confirmLabel: 'Unpublish',
    busyLabel: 'Unpublishing…',
  }
})

// ---- Leaving with unsaved changes ----

// A guard on the router, not onBeforeRouteLeave: /new and /:id share this page, so after a new
// lesson's first save the page stays, and a leave guard would still belong to /new.
const leaving = ref(false)
let answerLeave: ((leave: boolean) => void) | null = null

function answer(leave: boolean) {
  answerLeave?.(leave)
  answerLeave = null
  leaving.value = false
}

const removeGuard = router.beforeEach((to, from) => {
  if (!dirty.value || from.name !== route.name || to.fullPath === from.fullPath) return true
  leaving.value = true
  return new Promise<boolean>((resolve) => (answerLeave = resolve))
})

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value) event.preventDefault()
}
window.addEventListener('beforeunload', onBeforeUnload)
onUnmounted(() => {
  removeGuard()
  answer(false)
  window.removeEventListener('beforeunload', onBeforeUnload)
})
</script>

<template>
  <nav aria-label="Breadcrumb" class="text-sm font-semibold">
    <ol class="flex flex-wrap items-center gap-x-2">
      <li>
        <RouterLink
          :to="{ name: 'admin-lessons' }"
          class="inline-flex min-h-11 items-center text-evergreen hover:underline"
        >
          Lessons
        </RouterLink>
      </li>
      <li aria-hidden="true" class="text-line-strong">/</li>
      <li class="text-quiet">{{ id ? 'Edit' : 'New' }}</li>
    </ol>
  </nav>

  <div
    v-if="notFound"
    class="mt-4 flex max-w-xl flex-col items-start gap-4 rounded-card border border-line bg-surface p-6"
  >
    <div>
      <h1 class="text-2xl font-bold">We couldn’t find this lesson</h1>
      <p class="mt-1 text-quiet">Someone may have deleted it, or the link is wrong.</p>
    </div>
    <RouterLink :to="{ name: 'admin-lessons' }" :class="PRIMARY_BUTTON">See all lessons</RouterLink>
  </div>

  <ErrorPanel v-else-if="loadError" class="mt-4" :message="loadError" @retry="reload" />

  <template v-else>
    <div class="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <h1 class="text-3xl leading-tight font-bold text-balance sm:text-4xl">
          <template v-if="heading">{{ heading }}</template>
          <SkeletonText v-else tone="page" class="w-[12em] max-w-full" />
        </h1>
        <p class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-quiet">
          <template v-if="lesson">
            <LessonStatusBadge :published="lesson.isPublished" />
            <span>Edited {{ formatEdited(lesson.updatedAt) }}</span>
            <a
              v-if="lesson.isPublished"
              :href="`/lessons/${lesson.slug}`"
              target="_blank"
              rel="noopener"
              class="inline-flex min-h-11 items-center font-semibold text-evergreen hover:underline"
            >
              See it as students do<span class="sr-only">&nbsp;(opens in a new tab)</span>
            </a>
          </template>
          <template v-else-if="loading">
            <SkeletonText tone="page" class="w-[16em]" />
          </template>
          <template v-else>Not saved yet.</template>
        </p>
      </div>
    </div>

    <p
      v-if="notice"
      role="status"
      class="mt-6 flex items-center gap-3 rounded-card bg-evergreen-soft p-4 font-semibold text-evergreen"
    >
      <StrokeIcon :d="ICONS.finished" class="size-6" />
      {{ notice }}
    </p>

    <div
      v-if="loading"
      aria-busy="true"
      class="mt-8 rounded-card border border-line bg-surface p-7"
    >
      <p class="sr-only" role="status">Loading the lesson</p>
      <div aria-hidden="true" class="space-y-6">
        <p class="text-xl font-bold"><SkeletonText class="w-[9em]" /></p>
        <p class="text-lg"><SkeletonText class="w-full" /></p>
        <p class="text-lg"><SkeletonText class="w-4/5" /></p>
        <p class="text-lg"><SkeletonText class="w-2/3" /></p>
      </div>
    </div>

    <LessonForm
      v-else
      v-model:dirty="dirty"
      class="mt-8"
      :lesson="lesson"
      :start="start"
      :lessons="lessons"
      :saving="saving && !pending"
      :error="pending ? null : saveError"
      @save="onSave"
    />
  </template>

  <ConfirmDialog
    :open="pending !== null"
    :title="confirm.title"
    :message="confirm.message"
    :confirm-label="confirm.confirmLabel"
    :busy-label="confirm.busyLabel"
    :busy="saving"
    :error="saveError"
    @confirm="pending && commit(pending.input)"
    @close="stopPending"
  />

  <ConfirmDialog
    :open="leaving"
    title="Leave without saving?"
    message="The changes you made to this lesson since you last saved will be lost."
    confirm-label="Leave"
    busy-label="Leaving…"
    :busy="false"
    :error="null"
    @confirm="answer(true)"
    @close="answer(false)"
  />
</template>
