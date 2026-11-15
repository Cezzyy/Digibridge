<script setup lang="ts">
import {
  AGE_GROUP_LABELS,
  AREA_LABELS,
  DEVICE_LABELS,
  HIDDEN_IDENTITY,
  INTERNET_ACCESS_LABELS,
  LEVEL_LABELS,
  SEX_LABELS,
  SUS_ANSWER_LABELS,
  SUS_ANSWER_MIN,
  SUS_STATEMENTS,
  VOID_REASON_LABELS,
  type VoidAttempt,
} from '@digibridge/shared'
import { computed, ref, watch } from 'vue'
import { useRespondent } from '../../composables/useRespondent'
import { useRespondentActions } from '../../composables/useRespondentActions'
import type { RespondentRow } from '../../composables/useRespondents'
import { DANGER_BUTTON, SECONDARY_BUTTON } from '../../lib/buttons'
import { wholePct } from '../../lib/levels'
import LevelBadge from '../results/LevelBadge.vue'
import ScoreBar from '../results/ScoreBar.vue'
import SkeletonText from '../results/SkeletonText.vue'
import { ICONS } from './admin-icons'
import AnswerSheet from './AnswerSheet.vue'
import DeleteRespondentDialog from './DeleteRespondentDialog.vue'
import ErrorPanel from './ErrorPanel.vue'
import { formatDay } from './link-text'
import { classText, durationText, listText, modeText, nameText } from './respondent-text'
import RespondentDetailSkeleton from './RespondentDetailSkeleton.vue'
import RespondentStatusBadge from './RespondentStatusBadge.vue'
import StrokeIcon from './StrokeIcon.vue'
import VoidAttemptDialog from './VoidAttemptDialog.vue'

// One respondent's details in a panel from the right (DSH-05): profile, results per area, SUS
// answers, and for admins the answer sheet. A native modal dialog, so focus stays inside and Esc
// closes it. `id` null closes it. Hidden names read Hidden (PRO-05). `preview` is their row from
// the list when it's on the page: its name shows at once, and the loading placeholders take the
// shape of their mode and status. Admins can also void the attempt and delete the respondent
// (USR-03): `changed` asks the page to reload its list after a void, `deleted` after a delete.
const props = defineProps<{ id: string | null; preview: RespondentRow | null; isAdmin: boolean }>()
const emit = defineEmits<{ close: []; changed: []; deleted: [] }>()

const { detail, notFound, error, load } = useRespondent()
const dialog = ref<HTMLDialogElement | null>(null)

watch(
  () => props.id,
  (id) => {
    const el = dialog.value
    if (id) {
      void load(id)
      if (el && !el.open) el.showModal()
    } else if (el?.open) el.close()
  },
  { immediate: true, flush: 'post' },
)

const respondent = computed(() => detail.value?.respondent ?? null)
const attempt = computed(() => detail.value?.attempt ?? null)
/** Who the header names: the loaded respondent, else their row from the list. */
const shown = computed(() => respondent.value ?? props.preview)

/** How a voided attempt's void reads: "Voided on Nov 15, 2026:" and the reason. */
const voided = computed(() => {
  const a = attempt.value
  if (a?.status !== 'voided') return null
  return {
    when: a.voidedAt ? `Voided on ${formatDay(a.voidedAt)}:` : 'Voided:',
    reason: a.voidReason ? `${VOID_REASON_LABELS[a.voidReason]}.` : 'No reason given.',
  }
})

const actions = useRespondentActions()
const asking = ref<'void' | 'delete' | null>(null)

function ask(action: 'void' | 'delete') {
  actions.reset()
  asking.value = action
}

async function voidIt(input: VoidAttempt) {
  const attemptId = attempt.value?.id
  if (!attemptId || !props.id) return
  if (!(await actions.voidAttempt(attemptId, input))) return
  asking.value = null
  emit('changed')
  void load(props.id)
}

async function deleteIt() {
  if (!props.id) return
  if (!(await actions.deleteRespondent(props.id))) return
  asking.value = null
  emit('deleted')
}

const profile = computed(() => {
  const r = respondent.value
  if (!r) return []
  return [
    {
      label: 'Student number',
      value: r.identityHidden && r.mode === 'school' ? HIDDEN_IDENTITY : r.studentNumber,
    },
    { label: 'Course and year', value: classText(r) },
    { label: 'Came in', value: modeText(r) },
    { label: 'Sex', value: SEX_LABELS[r.sex] },
    { label: 'Age', value: `${r.age} (${AGE_GROUP_LABELS[r.ageGroup]})` },
    { label: 'Devices', value: listText(r.devices, DEVICE_LABELS) },
    { label: 'Internet', value: listText(r.internetAccess, INTERNET_ACCESS_LABELS) },
    { label: 'Consented', value: formatDay(r.consentedAt) },
  ].filter((row): row is { label: string; value: string } => !!row.value)
})
</script>

<template>
  <dialog
    ref="dialog"
    aria-labelledby="respondent-title"
    class="my-0 mr-0 ml-auto h-dvh max-h-none w-full max-w-2xl overflow-y-auto overscroll-contain bg-mist text-ink shadow-lg backdrop:bg-scrim"
    @close="emit('close')"
  >
    <div
      class="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-surface px-5 py-4 sm:px-7"
    >
      <div class="min-w-0">
        <p class="text-sm font-semibold tracking-wide text-quiet uppercase">Respondent</p>
        <h2
          id="respondent-title"
          class="mt-0.5 truncate text-2xl leading-tight font-bold"
          :class="{ 'text-quiet italic': shown?.identityHidden }"
        >
          <template v-if="shown">{{ nameText(shown) }}</template>
          <SkeletonText v-else class="w-48" />
        </h2>
        <p v-if="shown?.identityHidden" class="mt-1 text-sm text-quiet">
          They chose not to show their name to the team.
        </p>
      </div>
      <button type="button" :class="SECONDARY_BUTTON" class="shrink-0" @click="emit('close')">
        <StrokeIcon :d="ICONS.close" class="size-5" />
        Close
      </button>
    </div>

    <div class="space-y-5 px-5 py-6 sm:px-7">
      <p v-if="notFound" role="alert" class="rounded-card bg-mist-soft p-5 text-quiet">
        This respondent isn’t here anymore. Their data may have been deleted.
      </p>
      <ErrorPanel v-else-if="error && id" :message="error" @retry="load(id)" />

      <template v-else-if="!respondent">
        <RespondentDetailSkeleton
          :is-admin="isAdmin"
          :mode="preview?.mode"
          :status="preview?.status"
        />
        <p class="sr-only" role="status">Loading their details</p>
      </template>

      <template v-else>
        <section
          aria-labelledby="profile-heading"
          class="rounded-card border border-line bg-surface p-5"
        >
          <div class="flex items-center justify-between gap-3">
            <h3 id="profile-heading" class="text-lg font-bold">Profile</h3>
            <RespondentStatusBadge :status="respondent.status" />
          </div>
          <dl class="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <div v-for="row in profile" :key="row.label">
              <dt class="text-sm text-quiet">{{ row.label }}</dt>
              <dd class="font-semibold">{{ row.value }}</dd>
            </div>
          </dl>
        </section>

        <p
          v-if="!attempt"
          class="rounded-card border border-dashed border-line-strong/60 p-5 text-quiet"
        >
          They saved their profile but haven’t started the assessment.
        </p>

        <template v-else>
          <section
            aria-labelledby="results-heading"
            class="rounded-card border border-line bg-surface p-5"
          >
            <h3 id="results-heading" class="text-lg font-bold">Results</h3>
            <div
              v-if="attempt.status === 'voided'"
              class="mt-3 rounded-control bg-error-soft p-3 text-error"
            >
              <p>
                <span class="font-semibold">{{ voided?.when }}</span> {{ voided?.reason }}
              </p>
              <p v-if="attempt.voidNote" class="mt-1 whitespace-pre-line">
                {{ attempt.voidNote }}
              </p>
              <p class="mt-1">It’s left out of every result and stat, and they can start again.</p>
            </div>
            <p v-else-if="attempt.status === 'in_progress'" class="mt-2 text-quiet">
              Started {{ formatDay(attempt.startedAt) }}, still taking it. Scores show once they
              submit or time runs out.
            </p>

            <div
              v-if="attempt.overallLevel && attempt.overallPct !== null"
              class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2"
            >
              <LevelBadge :level="attempt.overallLevel" large />
              <p class="text-quiet">
                <span class="font-display text-2xl font-bold text-ink tabular-nums">
                  {{ wholePct(attempt.overallPct) }}%
                </span>
                overall, {{ attempt.totalPoints }} points
              </p>
            </div>
            <p v-if="attempt.timeTakenSeconds !== null" class="mt-2 text-sm text-quiet">
              {{ attempt.status === 'expired' ? 'Ran out of time after' : 'Took' }}
              {{ durationText(attempt.timeTakenSeconds) }}
              <template v-if="attempt.submittedAt"
                >, on {{ formatDay(attempt.submittedAt) }}</template
              >
            </p>

            <ul v-if="attempt.areas.length" class="mt-5 space-y-4">
              <li v-for="area in attempt.areas" :key="area.area">
                <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span class="font-semibold">{{ AREA_LABELS[area.area] }}</span>
                  <span class="flex items-center gap-2 text-sm">
                    <span class="tabular-nums">
                      {{ wholePct(area.pct) }}% · {{ area.points }} of {{ area.maxPoints }}
                    </span>
                    <LevelBadge :level="area.level" />
                  </span>
                </div>
                <ScoreBar class="mt-2" :pct="area.pct" :level="area.level" />
                <span class="sr-only">{{ LEVEL_LABELS[area.level] }}</span>
              </li>
            </ul>
          </section>

          <section
            aria-labelledby="sus-heading"
            class="rounded-card border border-line bg-surface p-5"
          >
            <div class="flex flex-wrap items-baseline justify-between gap-3">
              <h3 id="sus-heading" class="text-lg font-bold">Usability survey</h3>
              <p v-if="attempt.sus" class="font-display text-2xl font-bold tabular-nums">
                {{ attempt.sus.score }}
                <span class="text-base font-normal text-quiet">of 100</span>
              </p>
            </div>
            <p v-if="!attempt.sus" class="mt-2 text-quiet">Not answered.</p>
            <ol v-else class="mt-3 divide-y divide-line">
              <li
                v-for="(statement, i) in SUS_STATEMENTS"
                :key="i"
                class="flex items-start justify-between gap-4 py-2"
              >
                <span class="min-w-0">{{ i + 1 }}. {{ statement }}</span>
                <span class="shrink-0 text-right text-sm font-semibold whitespace-nowrap">
                  {{ attempt.sus.answers[i] }}
                  <span class="block font-normal text-quiet">
                    {{
                      SUS_ANSWER_LABELS[(attempt.sus.answers[i] ?? SUS_ANSWER_MIN) - SUS_ANSWER_MIN]
                    }}
                  </span>
                </span>
              </li>
            </ol>
          </section>

          <section
            v-if="isAdmin && attempt.answers"
            aria-labelledby="answers-heading"
            class="rounded-card border border-line bg-surface p-5"
          >
            <h3 id="answers-heading" class="text-lg font-bold">Answers</h3>
            <p class="mt-1 text-quiet">
              Each item in the order they saw it. Only admins see this; the respondent never sees
              which items they got right.
            </p>
            <AnswerSheet class="mt-5" :items="attempt.answers" />
          </section>
        </template>

        <section
          v-if="isAdmin"
          aria-labelledby="manage-heading"
          class="rounded-card border border-line bg-surface p-5"
        >
          <h3 id="manage-heading" class="text-lg font-bold">Manage</h3>
          <p class="mt-1 text-quiet">Only admins see this.</p>
          <div class="mt-4 divide-y divide-line">
            <div
              v-if="attempt && attempt.status !== 'voided'"
              class="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="min-w-0">
                <p class="font-semibold">Void the attempt</p>
                <p class="text-quiet">
                  When it went wrong, like a lost connection or the wrong person taking it. They can
                  start again.
                </p>
              </div>
              <button
                type="button"
                :class="DANGER_BUTTON"
                class="shrink-0 bg-surface"
                @click="ask('void')"
              >
                Void attempt
              </button>
            </div>
            <div
              class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              :class="{ 'pt-4': attempt && attempt.status !== 'voided' }"
            >
              <div class="min-w-0">
                <p class="font-semibold">Delete their data</p>
                <p class="text-quiet">
                  When they ask, as the Data Privacy Act allows. It can’t be undone.
                </p>
              </div>
              <button
                type="button"
                :class="DANGER_BUTTON"
                class="shrink-0 bg-surface"
                @click="ask('delete')"
              >
                Delete respondent
              </button>
            </div>
          </div>
        </section>
      </template>
    </div>

    <template v-if="isAdmin && respondent">
      <VoidAttemptDialog
        :open="asking === 'void'"
        :in-progress="attempt?.status === 'in_progress'"
        :busy="actions.voiding.value"
        :error="actions.voidError.value"
        @confirm="voidIt"
        @close="asking = null"
      />
      <DeleteRespondentDialog
        :open="asking === 'delete'"
        :name="respondent.identityHidden ? null : respondent.fullName"
        :mode="respondent.mode"
        :busy="actions.deleting.value"
        :error="actions.deleteError.value"
        @confirm="deleteIt"
        @close="asking = null"
      />
    </template>
  </dialog>
</template>
