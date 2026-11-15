<script setup lang="ts">
import {
  AREA_CODES,
  AREA_LABELS,
  areaCodeSchema,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  ITEMS_PER_DIFFICULTY,
  type AreaCode,
  type Difficulty,
} from '@digibridge/shared'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ICONS } from '../../components/admin/admin-icons'
import ErrorPanel from '../../components/admin/ErrorPanel.vue'
import QuestionStatusBadge from '../../components/admin/QuestionStatusBadge.vue'
import { ASSESSMENT_MIX } from '../../components/admin/question-text'
import StrokeIcon from '../../components/admin/StrokeIcon.vue'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import SkeletonText from '../../components/results/SkeletonText.vue'
import { useAdminQuestions, type AdminQuestionRow } from '../../composables/useAdminQuestions'
import { PRIMARY_BUTTON } from '../../lib/buttons'

// The questions editor's list (CMS-01, CMS-02), admin only: one area at a time (`?area=`, so
// coming back from the editor keeps it), its questions by difficulty, each group with how many
// are active against what an assessment needs (ITEMS_PER_DIFFICULTY). A question can be made
// active or inactive here; one no student has seen can be deleted, while a seen one can only be
// made inactive, so past attempts keep every item they showed. Making one inactive asks first
// when it leaves too few for an assessment to start; deleting always asks, and warns of that too.
// While the list loads, the groups are drawn already, with placeholders where the questions go.
const route = useRoute()
const router = useRouter()
const {
  questions,
  loadError,
  load,
  deletingId,
  deleteError,
  remove,
  togglingId,
  toggleError,
  setActive,
} = useAdminQuestions()
onMounted(load)

const area = computed<AreaCode>(
  () => areaCodeSchema.safeParse(route.query.area).data ?? AREA_CODES[0],
)
const pickArea = (code: AreaCode) => router.replace({ query: { ...route.query, area: code } })

const inArea = (code: AreaCode) => (questions.value ?? []).filter((q) => q.area === code)
const activeIn = (code: AreaCode, difficulty: Difficulty) =>
  inArea(code).filter((q) => q.difficulty === difficulty && q.isActive).length

/** Areas with too few active questions in some difficulty, so no assessment can start. */
const short = computed(
  () =>
    Object.fromEntries(
      AREA_CODES.map((code) => [
        code,
        DIFFICULTIES.some((d) => activeIn(code, d) < ITEMS_PER_DIFFICULTY[d]),
      ]),
    ) as Record<AreaCode, boolean>,
)

const groups = computed(() =>
  DIFFICULTIES.map((difficulty) => ({
    difficulty,
    rows: inArea(area.value).filter((q) => q.difficulty === difficulty),
    active: activeIn(area.value, difficulty),
    need: ITEMS_PER_DIFFICULTY[difficulty],
  })),
)

const newQuestionLink = (difficulty?: Difficulty) => ({
  name: 'admin-question-new',
  query: difficulty ? { area: area.value, difficulty } : { area: area.value },
})

// ---- Active or inactive ----

/** Whether taking this question out of use leaves its area too few for an assessment. */
const leavesTooFew = (row: AdminQuestionRow) =>
  row.isActive && activeIn(row.area, row.difficulty) - 1 < ITEMS_PER_DIFFICULTY[row.difficulty]
const tooFewWarning = (row: AdminQuestionRow) =>
  `${AREA_LABELS[row.area]} will have too few active ${DIFFICULTY_LABELS[row.difficulty].toLowerCase()} questions, so students can’t start the assessment until you add or turn on another one.`

// Making one inactive asks first if the area would then have too few for an assessment.
const deactivating = ref<AdminQuestionRow | null>(null)
function toggle(row: AdminQuestionRow) {
  if (leavesTooFew(row)) deactivating.value = row
  else void setActive(row.id, !row.isActive)
}
async function confirmDeactivate() {
  if (deactivating.value && (await setActive(deactivating.value.id, false))) {
    deactivating.value = null
  }
}
function stopDeactivating() {
  deactivating.value = null
  toggleError.value = null
}

// ---- Deleting ----

// Deleting always asks first: a question can't be brought back. Like making one inactive, it
// warns when the area would then have too few for an assessment.
const deleting = ref<AdminQuestionRow | null>(null)
const deleteMessage = computed(() => {
  const row = deleting.value
  if (!row) return ''
  const gone = 'It will be gone for good. No student has seen it, so past results don’t change.'
  return leavesTooFew(row) ? `${gone} ${tooFewWarning(row)}` : gone
})
async function confirmDelete() {
  if (deleting.value && (await remove(deleting.value.id))) deleting.value = null
}
function stopDeleting() {
  deleting.value = null
  deleteError.value = null
}
</script>

<template>
  <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 class="text-3xl leading-tight font-bold sm:text-4xl">Questions</h1>
      <p class="mt-2 max-w-2xl text-lg text-quiet">
        Write the assessment’s questions. Each assessment picks {{ ASSESSMENT_MIX }} active
        questions per area at random. Once students have seen a question, its area, difficulty and
        right answer can’t change. To see how each question did, open
        <RouterLink
          :to="{ name: 'admin-items' }"
          class="font-semibold text-evergreen underline-offset-4 hover:underline"
          >Item analysis</RouterLink
        >.
      </p>
    </div>
    <RouterLink :to="newQuestionLink()" :class="PRIMARY_BUTTON" class="shrink-0 self-start">
      <StrokeIcon :d="ICONS.plus" class="size-5" />
      New question
    </RouterLink>
  </div>

  <ErrorPanel v-if="loadError" class="mt-8" :message="loadError" @retry="load" />

  <template v-else>
    <div
      role="group"
      aria-label="Area"
      class="mt-8 flex flex-wrap gap-1 rounded-card border border-line bg-surface p-1"
    >
      <button
        v-for="code in AREA_CODES"
        :key="code"
        type="button"
        :aria-pressed="area === code"
        class="flex min-h-11 items-center gap-2 rounded-control px-3 font-semibold text-quiet transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-evergreen aria-pressed:bg-evergreen-soft aria-pressed:text-evergreen"
        @click="pickArea(code)"
      >
        {{ AREA_LABELS[code] }}
        <span
          v-if="questions && short[code]"
          class="rounded-full bg-marigold-soft px-2 text-sm text-marigold-text"
        >
          Too few
        </span>
      </button>
    </div>

    <p v-if="toggleError && !deactivating" role="alert" class="mt-4 font-semibold text-error">
      {{ toggleError }}
    </p>

    <p v-if="!questions" class="sr-only" role="status">Loading the questions</p>

    <section
      v-for="group in groups"
      :key="group.difficulty"
      :aria-labelledby="`difficulty-${group.difficulty}-heading`"
      class="mt-8"
    >
      <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 :id="`difficulty-${group.difficulty}-heading`" class="text-xl font-bold">
          {{ DIFFICULTY_LABELS[group.difficulty] }}
        </h2>
        <p
          v-if="questions"
          class="font-semibold tabular-nums"
          :class="group.active < group.need ? 'text-marigold-text' : 'text-quiet'"
        >
          {{ group.active }} active · {{ group.need }} needed
        </p>
      </div>

      <ul class="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
        <!-- Placeholders the size of a question while the list loads. -->
        <li v-if="!questions" aria-hidden="true" class="p-4">
          <p><SkeletonText class="w-4/5" /></p>
          <p class="mt-1 text-sm"><SkeletonText class="w-[12em]" /></p>
        </li>

        <template v-else>
          <li
            v-for="row in group.rows"
            :key="row.id"
            class="p-4"
            :class="!row.isActive && 'bg-mist-soft/40'"
          >
            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <RouterLink
                :to="{ name: 'admin-question', params: { id: row.id } }"
                class="line-clamp-3 min-w-0 leading-snug whitespace-pre-line hover:underline"
                :class="row.isActive ? 'text-ink' : 'text-quiet'"
              >
                {{ row.stem }}
              </RouterLink>
              <QuestionStatusBadge :active="row.isActive" class="self-start" />
            </div>
            <p class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-quiet">
              <span v-if="row.shown" class="flex items-center gap-1">
                <StrokeIcon :d="ICONS.lock" class="size-4" />
                Seen by students
              </span>
              <span v-if="row.isScenario">Scenario</span>
              <span v-if="row.imageUrl">Has a picture</span>
            </p>
            <div class="mt-1 flex flex-wrap gap-x-4 text-sm font-semibold">
              <RouterLink
                :to="{ name: 'admin-question', params: { id: row.id } }"
                class="inline-flex min-h-11 items-center text-evergreen hover:underline"
              >
                Edit<span class="sr-only">&nbsp;this question</span>
              </RouterLink>
              <button
                type="button"
                class="inline-flex min-h-11 items-center text-evergreen hover:underline disabled:cursor-wait"
                :disabled="togglingId === row.id"
                @click="toggle(row)"
              >
                {{ row.isActive ? 'Make inactive' : 'Make active' }}
              </button>
              <button
                v-if="!row.shown"
                type="button"
                class="inline-flex min-h-11 items-center text-error hover:underline disabled:cursor-wait"
                :disabled="deletingId === row.id"
                @click="deleting = row"
              >
                Delete<span class="sr-only">&nbsp;this question</span>
              </button>
            </div>
          </li>

          <li v-if="group.rows.length === 0" class="p-4 text-quiet">
            No {{ DIFFICULTY_LABELS[group.difficulty].toLowerCase() }} questions in this area yet.
          </li>
        </template>

        <li v-if="questions" class="px-4 py-1">
          <RouterLink
            :to="newQuestionLink(group.difficulty)"
            class="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-evergreen hover:underline"
          >
            <StrokeIcon :d="ICONS.plus" class="size-4" />
            Add a question
            <span class="sr-only">
              to {{ AREA_LABELS[area] }}, {{ DIFFICULTY_LABELS[group.difficulty] }}
            </span>
          </RouterLink>
        </li>
      </ul>
    </section>
  </template>

  <ConfirmDialog
    :open="deactivating !== null"
    title="Make this question inactive?"
    :message="
      deactivating
        ? `${tooFewWarning(deactivating)} Assessments already started keep their questions.`
        : ''
    "
    confirm-label="Make inactive"
    busy-label="Saving…"
    :busy="togglingId !== null"
    :error="toggleError"
    @confirm="confirmDeactivate"
    @close="stopDeactivating"
  />

  <ConfirmDialog
    :open="deleting !== null"
    title="Delete this question?"
    :message="deleteMessage"
    confirm-label="Delete question"
    busy-label="Deleting…"
    :busy="deletingId !== null"
    :error="deleteError"
    danger
    @confirm="confirmDelete"
    @close="stopDeleting"
  />
</template>
