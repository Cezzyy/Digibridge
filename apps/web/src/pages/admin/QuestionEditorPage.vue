<script setup lang="ts">
import {
  AREA_LABELS,
  areaCodeSchema,
  DIFFICULTY_LABELS,
  difficultySchema,
  type QuestionInput,
} from '@digibridge/shared'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter, type RouteLocationNormalized } from 'vue-router'
import { ICONS } from '../../components/admin/admin-icons'
import ErrorPanel from '../../components/admin/ErrorPanel.vue'
import { formatEdited } from '../../components/admin/lesson-text'
import QuestionForm from '../../components/admin/QuestionForm.vue'
import QuestionStatusBadge from '../../components/admin/QuestionStatusBadge.vue'
import StrokeIcon from '../../components/admin/StrokeIcon.vue'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import SkeletonText from '../../components/results/SkeletonText.vue'
import { useQuestionEditor } from '../../composables/useQuestionEditor'
import { PRIMARY_BUTTON } from '../../lib/buttons'

// One question in the questions editor (CMS-01 to CMS-03), admin only: /admin/questions/new for
// a new one (`?area=&difficulty=` from the list picks its place), /admin/questions/:id for a
// saved one. The form and its preview are in QuestionForm; this page loads and saves. After a new
// question's first save, the address becomes its own. Leaving with unsaved changes asks first,
// inside the app and when closing the tab.
const route = useRoute()
const router = useRouter()
const { question, notFound, loadError, load, saving, saveError, save } = useQuestionEditor()

/** The saved question's ID, or null on /admin/questions/new. */
const id = computed(() => (route.name === 'admin-question' ? String(route.params.id) : null))
// The same page shows /new and /:id, so a new question's first save stays on it: no reload then.
watch(
  id,
  (value) => {
    if (value && value !== question.value?.id) void load(value)
    if (!value) question.value = null
  },
  { immediate: true },
)
const reload = () => id.value && load(id.value)

const start = computed(() => ({
  area: areaCodeSchema.safeParse(route.query.area).data,
  difficulty: difficultySchema.safeParse(route.query.difficulty).data,
}))

const loading = computed(
  () => id.value !== null && !question.value && !notFound.value && !loadError.value,
)
const heading = computed(() => {
  if (!id.value) return 'New question'
  const q = question.value
  return q ? `${AREA_LABELS[q.area]}, ${DIFFICULTY_LABELS[q.difficulty].toLowerCase()}` : null
})

// ---- Saving ----

const dirty = ref(false)
const notice = ref<string | null>(null)
// The next change makes "Saved." untrue, so it goes then, not only on the next save.
watch(dirty, (changed) => {
  if (changed) notice.value = null
})

/** A save waiting on the reminder: rewording a question students have seen. */
const pending = ref<QuestionInput | null>(null)

/**
 * Whether the save changes what students read: the question or a choice's text. Past answers point
 * at the choices, so the answer sheet and item analysis show them with the new wording.
 */
function rewords(input: QuestionInput): boolean {
  const was = question.value
  if (!was) return false
  return (
    input.stem.trim() !== was.stem ||
    input.choices.some((choice, i) => choice.label.trim() !== was.choices[i]?.label)
  )
}

function onSave(input: QuestionInput) {
  notice.value = null
  if (question.value?.shown && rewords(input)) pending.value = input
  else void commit(input)
}

function confirmPending() {
  const input = pending.value
  pending.value = null
  if (input) void commit(input)
}

async function commit(input: QuestionInput) {
  // The saved question's own ID, not the address's: after a new question's first save the
  // address changes only once `router.replace` ends, or not at all if that's cut short.
  const saved = await save(input, question.value?.id ?? id.value ?? undefined)
  if (!saved) return
  // `dirty` follows the form, which keeps anything typed while this saved.
  notice.value = id.value ? 'Saved.' : 'Added.'
  if (!id.value) await router.replace({ name: 'admin-question', params: { id: saved.id } })
}

// ---- Leaving with unsaved changes ----

// A guard on the router, not onBeforeRouteLeave: /new and /:id share this page, so after a new
// question's first save the page stays, and a leave guard would still belong to /new.
const leaving = ref(false)
let answerLeave: ((leave: boolean) => void) | null = null

function answer(leave: boolean) {
  answerLeave?.(leave)
  answerLeave = null
  leaving.value = false
}

/** The saved question's own address, which a new question's first save moves to without leaving. */
const ownAddress = (to: RouteLocationNormalized) =>
  to.name === 'admin-question' && question.value !== null && to.params.id === question.value.id

const removeGuard = router.beforeEach((to, from) => {
  if (!dirty.value || from.name !== route.name || to.fullPath === from.fullPath || ownAddress(to))
    return true
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
          :to="{ name: 'admin-questions', query: question ? { area: question.area } : {} }"
          class="inline-flex min-h-11 items-center text-evergreen hover:underline"
        >
          Questions
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
      <h1 class="text-2xl font-bold">We couldn’t find this question</h1>
      <p class="mt-1 text-quiet">Someone may have deleted it, or the link is wrong.</p>
    </div>
    <RouterLink :to="{ name: 'admin-questions' }" :class="PRIMARY_BUTTON">
      See all questions
    </RouterLink>
  </div>

  <ErrorPanel v-else-if="loadError" class="mt-4" :message="loadError" @retry="reload" />

  <template v-else>
    <div class="mt-2 min-w-0">
      <h1 class="text-3xl leading-tight font-bold text-balance sm:text-4xl">
        <template v-if="heading">{{ heading }}</template>
        <SkeletonText v-else tone="page" class="w-[12em] max-w-full" />
      </h1>
      <p class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-quiet">
        <template v-if="question">
          <QuestionStatusBadge :active="question.isActive" />
          <span v-if="question.shown" class="flex items-center gap-1.5">
            <StrokeIcon :d="ICONS.lock" class="size-4" />
            Students have seen it
          </span>
          <span>Edited {{ formatEdited(question.updatedAt) }}</span>
        </template>
        <SkeletonText v-else-if="loading" tone="page" class="w-[16em]" />
        <template v-else>Not saved yet.</template>
      </p>
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
      <p class="sr-only" role="status">Loading the question</p>
      <div aria-hidden="true" class="space-y-6">
        <p class="text-xl font-bold"><SkeletonText class="w-[9em]" /></p>
        <p class="text-lg"><SkeletonText class="w-full" /></p>
        <p class="text-lg"><SkeletonText class="w-4/5" /></p>
        <p class="text-lg"><SkeletonText class="w-2/3" /></p>
      </div>
    </div>

    <QuestionForm
      v-else
      v-model:dirty="dirty"
      class="mt-8"
      :question="question"
      :start="start"
      :saving="saving"
      :error="saveError"
      @save="onSave"
    />
  </template>

  <ConfirmDialog
    :open="pending !== null"
    title="Change the wording?"
    message="Students have already seen this question. Their past answers will show the new wording, so keep each choice meaning the same. To ask something different, make this question inactive and add a new one."
    confirm-label="Save"
    busy-label="Saving…"
    :busy="false"
    :error="null"
    @confirm="confirmPending"
    @close="pending = null"
  />

  <ConfirmDialog
    :open="leaving"
    title="Leave without saving?"
    message="The changes you made to this question since you last saved will be lost."
    confirm-label="Leave"
    busy-label="Leaving…"
    :busy="false"
    :error="null"
    @confirm="answer(true)"
    @close="answer(false)"
  />
</template>
