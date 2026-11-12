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
} from '@digibridge/shared'
import { computed, ref, watch } from 'vue'
import { useRespondent } from '../../composables/useRespondent'
import { SECONDARY_BUTTON } from '../../lib/buttons'
import { wholePct } from '../../lib/levels'
import LevelBadge from '../results/LevelBadge.vue'
import ScoreBar from '../results/ScoreBar.vue'
import SkeletonText from '../results/SkeletonText.vue'
import { ICONS } from './admin-icons'
import AnswerSheet from './AnswerSheet.vue'
import ErrorPanel from './ErrorPanel.vue'
import { formatDay } from './link-text'
import { classText, durationText, listText, modeText, nameText } from './respondent-text'
import RespondentStatusBadge from './RespondentStatusBadge.vue'
import StrokeIcon from './StrokeIcon.vue'

// One respondent's details in a panel from the right (DSH-05): profile, results per area, SUS
// answers, and for admins the answer sheet. A native modal dialog, so focus stays inside and Esc
// closes it. `id` null closes it. Hidden names read Hidden (PRO-05).
const props = defineProps<{ id: string | null; isAdmin: boolean }>()
const emit = defineEmits<{ close: [] }>()

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
          :class="{ 'text-quiet italic': respondent?.identityHidden }"
        >
          <template v-if="respondent">{{ nameText(respondent) }}</template>
          <SkeletonText v-else class="w-48" />
        </h2>
        <p v-if="respondent?.identityHidden" class="mt-1 text-sm text-quiet">
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

      <template v-else>
        <section
          aria-labelledby="profile-heading"
          class="rounded-card border border-line bg-surface p-5"
        >
          <div class="flex items-center justify-between gap-3">
            <h3 id="profile-heading" class="text-lg font-bold">Profile</h3>
            <RespondentStatusBadge v-if="respondent" :status="respondent.status" />
          </div>
          <dl class="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2" :aria-busy="!respondent">
            <template v-if="respondent">
              <div v-for="row in profile" :key="row.label">
                <dt class="text-sm text-quiet">{{ row.label }}</dt>
                <dd class="font-semibold">{{ row.value }}</dd>
              </div>
            </template>
            <template v-else>
              <div v-for="n in 6" :key="n">
                <dt class="text-sm text-quiet"><SkeletonText class="w-20" /></dt>
                <dd class="font-semibold"><SkeletonText class="w-32" /></dd>
              </div>
            </template>
          </dl>
        </section>

        <template v-if="respondent">
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
              <p
                v-if="attempt.status === 'voided'"
                class="mt-3 rounded-control bg-error-soft p-3 text-error"
              >
                <span class="font-semibold">Voided.</span>
                {{ attempt.voidReason ?? 'No reason given.' }}
              </p>
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
                        SUS_ANSWER_LABELS[
                          (attempt.sus.answers[i] ?? SUS_ANSWER_MIN) - SUS_ANSWER_MIN
                        ]
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
        </template>
      </template>
    </div>
  </dialog>
</template>
