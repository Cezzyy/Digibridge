<script setup lang="ts">
import {
  AREA_CODES,
  AREA_LABELS,
  CHOICES_PER_QUESTION,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  ITEMS_PER_DIFFICULTY,
  POINTS_PER_DIFFICULTY,
  QUESTION_CHOICE_MAX,
  QUESTION_EXPLANATION_MAX,
  QUESTION_STEM_MAX,
  questionInputSchema,
  type AreaCode,
  type Difficulty,
  type QuestionInput,
} from '@digibridge/shared'
import { computed, onUnmounted, ref, useId, watch } from 'vue'
import type { AdminQuestion } from '../../composables/useQuestionEditor'
import { PRIMARY_BUTTON } from '../../lib/buttons'
import FixedField from '../form/FixedField.vue'
import SelectField from '../form/SelectField.vue'
import TextAreaField from '../form/TextAreaField.vue'
import TextField from '../form/TextField.vue'
import FormSection from '../start/FormSection.vue'
import QuestionPreview from './QuestionPreview.vue'

// The questions editor (CMS-01 to CMS-03): a question's area and difficulty, its text and
// picture, its 4 choices with the right one marked, and a note for the team, with a preview
// beside the form from `xl` and behind a Preview button below that. Checked with the API's own
// schema; errors show once Save is pressed, then follow each change. Once students have seen it
// (`shown`), its area, difficulty and right answer are fixed (CMS-02): they show as fixed fields,
// and only the wording can change. After a save the page passes the saved question back in
// `question`, and the form starts again from it, keeping anything typed while it saved. `dirty`
// tells the page about unsaved changes.

const props = defineProps<{
  /** The saved question, or null for a new one. */
  question: AdminQuestion | null
  /** For a new question: its area and difficulty, from the list's Add a question link. */
  start?: { area?: AreaCode; difficulty?: Difficulty }
  saving: boolean
  error: string | null
}>()
const emit = defineEmits<{ save: [input: QuestionInput] }>()
const dirty = defineModel<boolean>('dirty', { default: false })

type Draft = {
  area: AreaCode
  difficulty: Difficulty
  stem: string
  imageUrl: string
  isScenario: boolean
  explanation: string
  choices: string[]
  /** The right choice's position, or -1 before one is picked. */
  correct: number
  isActive: boolean
}

const draftOf = (question: AdminQuestion | null): Draft => ({
  area: question?.area ?? props.start?.area ?? AREA_CODES[0],
  difficulty: question?.difficulty ?? props.start?.difficulty ?? DIFFICULTIES[0],
  stem: question?.stem ?? '',
  imageUrl: question?.imageUrl ?? '',
  isScenario: question?.isScenario ?? false,
  explanation: question?.explanation ?? '',
  choices: question?.choices.map((c) => c.label) ?? Array(CHOICES_PER_QUESTION).fill(''),
  correct: question?.choices.findIndex((c) => c.isCorrect) ?? -1,
  isActive: question?.isActive ?? true,
})

const draft = ref<Draft>(draftOf(props.question))
const snapshot = () => JSON.stringify(draft.value)
const saved = ref(snapshot())
const tried = ref(false)
/** The draft as it was when Save was pressed, to tell whether it changed while saving. */
let sent: string | null = null

watch(
  () => props.question,
  (question) => {
    const next = draftOf(question)
    // The fields stay open while saving, so keep anything typed since Save was pressed: it
    // stays unsaved against the question that came back.
    const typedSince = question !== null && sent !== null && snapshot() !== sent
    if (!typedSince) Object.assign(draft.value, next)
    saved.value = JSON.stringify(next)
    sent = null
    tried.value = false
  },
)

const unsaved = computed(() => snapshot() !== saved.value)
watch(unsaved, (value) => (dirty.value = value), { immediate: true })

/** Students have seen it: its area, difficulty and right answer are fixed (CMS-02). */
const locked = computed(() => props.question?.shown ?? false)
// A save can find it seen since the page loaded (a 409): put back what's fixed now, keeping the
// rest of the draft, so the next save doesn't ask for the same change.
watch(locked, (now) => {
  const question = props.question
  if (!now || !question) return
  draft.value.area = question.area
  draft.value.difficulty = question.difficulty
  draft.value.correct = question.choices.findIndex((c) => c.isCorrect)
})

const AREA_OPTIONS = AREA_CODES.map((code) => ({ value: code, label: AREA_LABELS[code] }))
const DIFFICULTY_OPTIONS = DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABELS[d] }))
const DIFFICULTY_HINT = `${DIFFICULTIES.map(
  (d) =>
    `${DIFFICULTY_LABELS[d]} is worth ${POINTS_PER_DIFFICULTY[d]} ${POINTS_PER_DIFFICULTY[d] === 1 ? 'point' : 'points'}`,
).join(', ')}.`
const and = new Intl.ListFormat('en', { type: 'conjunction' })
/** "Each assessment picks 4 basic, 4 intermediate and 2 advanced questions per area.", from ITEMS_PER_DIFFICULTY. */
const PLACE_DESCRIPTION = `The area it tests and how hard it is. Each assessment picks ${and.format(
  DIFFICULTIES.map((d) => `${ITEMS_PER_DIFFICULTY[d]} ${DIFFICULTY_LABELS[d].toLowerCase()}`),
)} questions per area.`
const LOCK_HINT = 'Fixed: students have seen this question.'

const letter = (i: number) => String.fromCharCode(65 + i)

/** What the API gets. An empty picture link is null; an empty explanation becomes null there. */
const inputFor = (): QuestionInput => ({
  area: draft.value.area,
  difficulty: draft.value.difficulty,
  stem: draft.value.stem,
  imageUrl: draft.value.imageUrl.trim() || null,
  isScenario: draft.value.isScenario,
  explanation: draft.value.explanation,
  choices: draft.value.choices.map((label, i) => ({ label, isCorrect: i === draft.value.correct })),
  isActive: draft.value.isActive,
})

const result = computed(() => questionInputSchema.safeParse(inputFor()))

type Field = 'stem' | 'imageUrl' | 'explanation'
type Issues = { fields: Partial<Record<Field, string>>; choices: string[]; correct?: string }

/** The first problem with each field, shown or not. */
const issues = computed<Issues>(() => {
  const found: Issues = { fields: {}, choices: [] }
  if (result.value.success) return found
  for (const issue of result.value.error.issues) {
    const [field, row] = issue.path
    if (field === 'choices') {
      if (typeof row === 'number') found.choices[row] ??= issue.message
      else found.correct ??= issue.message
    } else if (field === 'stem' || field === 'imageUrl' || field === 'explanation') {
      found.fields[field] ??= issue.message
    }
  }
  return found
})
const errors = computed<Issues>(() => (tried.value ? issues.value : { fields: {}, choices: [] }))

const done = computed(() => {
  const i = issues.value
  return {
    place: true,
    question: !i.fields.stem && !i.fields.imageUrl,
    choices: i.choices.length === 0 && !i.correct,
    note: draft.value.explanation.trim() !== '' && !i.fields.explanation,
  }
})

function save() {
  tried.value = true
  if (!result.value.success) return
  sent = snapshot()
  emit('save', inputFor())
}

// Below `xl`, the form and the preview take turns.
const VIEWS = { edit: 'Edit', preview: 'Preview' } as const
const view = ref<keyof typeof VIEWS>('edit')

// The preview follows the text a moment after typing stops.
const preview = ref({ stem: draft.value.stem, choices: [...draft.value.choices] })
let timer: ReturnType<typeof setTimeout> | undefined
watch(
  () => [draft.value.stem, ...draft.value.choices],
  () => {
    clearTimeout(timer)
    timer = setTimeout(
      () => (preview.value = { stem: draft.value.stem, choices: [...draft.value.choices] }),
      200,
    )
  },
)
onUnmounted(() => clearTimeout(timer))

const id = useId()
const choicesHintId = `${id}-choices-hint`
const correctErrorId = `${id}-correct-error`
</script>

<template>
  <div>
    <div
      role="group"
      aria-label="Show"
      class="mb-4 flex gap-1 rounded-card border border-line bg-surface p-1 xl:hidden"
    >
      <button
        v-for="(name, option) in VIEWS"
        :key="option"
        type="button"
        :aria-pressed="view === option"
        class="flex min-h-11 flex-1 items-center justify-center rounded-control px-3 font-semibold text-quiet transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-evergreen aria-pressed:bg-evergreen-soft aria-pressed:text-evergreen"
        @click="view = option"
      >
        {{ name }}
      </button>
    </div>

    <div class="grid gap-8 xl:grid-cols-2 xl:items-start">
      <form
        novalidate
        aria-label="Question"
        class="divide-y divide-line rounded-card border border-line bg-surface"
        :class="view === 'preview' && 'max-xl:hidden'"
        @submit.prevent="save"
      >
        <FormSection
          :number="1"
          title="Where it goes"
          :description="PLACE_DESCRIPTION"
          :done="done.place"
          stacked
        >
          <template v-if="locked">
            <FixedField label="Area" :value="AREA_LABELS[draft.area]" :hint="LOCK_HINT" />
            <FixedField
              label="Difficulty"
              :value="DIFFICULTY_LABELS[draft.difficulty]"
              :hint="LOCK_HINT"
            />
          </template>
          <template v-else>
            <SelectField v-model="draft.area" label="Area" :options="AREA_OPTIONS" />
            <SelectField
              v-model="draft.difficulty"
              label="Difficulty"
              :hint="DIFFICULTY_HINT"
              :options="DIFFICULTY_OPTIONS"
            />
          </template>
          <label class="flex cursor-pointer items-start gap-3">
            <input v-model="draft.isActive" type="checkbox" class="mt-1 size-5 accent-evergreen" />
            <span>
              <span class="text-lg font-semibold">Use in new assessments</span>
              <span class="block text-quiet">
                When this is off, no new assessment picks it. Assessments that already have it keep
                it.
              </span>
            </span>
          </label>
        </FormSection>

        <FormSection :number="2" title="The question" :done="done.question" stacked>
          <TextAreaField
            v-model="draft.stem"
            label="Question"
            hint="Leave a blank line to start a new paragraph. A paragraph inside “ and ” (a text, a post, an email) shows as a quote."
            :rows="6"
            :error="errors.fields.stem"
            :maxlength="QUESTION_STEM_MAX"
          />
          <label class="flex cursor-pointer items-start gap-3">
            <input
              v-model="draft.isScenario"
              type="checkbox"
              class="mt-1 size-5 accent-evergreen"
            />
            <span>
              <span class="text-lg font-semibold">Scenario question</span>
              <span class="block text-quiet">
                It sets up a situation, like a message or a post, before it asks.
              </span>
            </span>
          </label>
          <TextField
            v-model="draft.imageUrl"
            label="Picture link"
            hint="Optional. A link to an image, starting with https://. It shows above the question."
            :error="errors.fields.imageUrl"
            inputmode="url"
            autocomplete="off"
          />
        </FormSection>

        <FormSection
          :number="3"
          title="The choices"
          :description="
            locked
              ? 'Students have seen this question, so the right answer stays as it is. You can still fix the wording, but keep each choice meaning the same.'
              : `Write ${CHOICES_PER_QUESTION} choices and mark the right one. Each student gets them in a different order.`
          "
          :done="done.choices"
          stacked
        >
          <fieldset
            :aria-describedby="errors.correct ? correctErrorId : choicesHintId"
            class="space-y-6"
          >
            <legend class="sr-only">Choices and the right answer</legend>
            <p :id="choicesHintId" class="sr-only">Mark one choice as the right answer.</p>
            <div v-for="(_, i) in draft.choices" :key="i">
              <TextField
                v-model="draft.choices[i]!"
                :label="`Choice ${letter(i)}`"
                :error="errors.choices[i]"
                :maxlength="QUESTION_CHOICE_MAX"
                autocomplete="off"
              />
              <label
                class="mt-2 inline-flex min-h-11 items-center gap-2.5 font-semibold"
                :class="locked ? 'cursor-not-allowed text-quiet' : 'cursor-pointer'"
              >
                <input
                  v-model="draft.correct"
                  type="radio"
                  :name="`${id}-correct`"
                  :value="i"
                  :disabled="locked"
                  class="size-5 accent-evergreen"
                />
                <span :class="draft.correct === i && 'text-evergreen'">
                  {{ draft.correct === i ? 'Right answer' : 'Mark as the right answer' }}
                  <span class="sr-only">: choice {{ letter(i) }}</span>
                </span>
              </label>
            </div>
            <p v-if="errors.correct" :id="correctErrorId" class="font-semibold text-error">
              {{ errors.correct }}
            </p>
          </fieldset>
        </FormSection>

        <FormSection
          :number="4"
          title="Note for the team"
          description="Optional. Students never see it: their results show levels, not which questions they got right."
          :done="done.note"
          stacked
        >
          <TextAreaField
            v-model="draft.explanation"
            label="Why the right answer is right"
            :error="errors.fields.explanation"
            :maxlength="QUESTION_EXPLANATION_MAX"
          />
        </FormSection>

        <footer
          class="sticky bottom-0 flex flex-col gap-4 rounded-b-card bg-mist-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7"
        >
          <p v-if="error" role="alert" class="font-semibold text-error">{{ error }}</p>
          <p v-else-if="tried && !result.success" role="alert" class="font-semibold text-error">
            Fix what’s marked above.
          </p>
          <p v-else class="text-quiet">
            {{
              unsaved
                ? 'You have changes that aren’t saved.'
                : question
                  ? 'All changes saved.'
                  : 'Fill in the question, then save it.'
            }}
          </p>
          <button type="submit" :class="PRIMARY_BUTTON" class="shrink-0" :disabled="saving">
            {{ saving ? 'Saving…' : question ? 'Save changes' : 'Add question' }}
          </button>
        </footer>
      </form>

      <section
        aria-label="Preview"
        class="overflow-hidden rounded-card border border-line xl:sticky xl:top-[calc(var(--spacing-header)+1rem)] xl:flex xl:max-h-[calc(100dvh-var(--spacing-header)-2rem)] xl:flex-col"
        :class="view === 'edit' && 'max-xl:hidden'"
      >
        <p class="border-b border-line bg-surface px-5 py-3 text-sm font-semibold text-quiet">
          Preview: how students see it
        </p>
        <div class="xl:min-h-0 xl:overflow-y-auto">
          <QuestionPreview
            :area="draft.area"
            :stem="preview.stem"
            :image-url="draft.imageUrl"
            :is-scenario="draft.isScenario"
            :choices="preview.choices"
          />
        </div>
      </section>
    </div>
  </div>
</template>
