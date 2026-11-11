<script setup lang="ts">
import {
  addDays,
  COURSES,
  LINK_LABEL_MAX_LENGTH,
  LINK_MAX_DAYS,
  LINK_MAX_RESPONSES,
  LINK_SCHOOL_MAX_LENGTH,
  schoolLinkSchema,
  YEAR_LEVEL_LABELS,
  YEAR_LEVELS,
  yearLevelsFor,
  type Course,
  type SchoolLinkInput,
  type YearLevel,
} from '@digibridge/shared'
import { computed, reactive, ref, watch } from 'vue'
import { useToday } from '../../composables/useToday'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../lib/buttons'
import DateField from '../form/DateField.vue'
import SelectField from '../form/SelectField.vue'
import TextField from '../form/TextField.vue'
import FormSection from '../start/FormSection.vue'
import { ICONS } from './admin-icons'
import { formatIsoDay } from './link-text'
import StrokeIcon from './StrokeIcon.vue'

// Makes a school link (LNK-01): the school, a name for the class, the last day it stays open,
// and optionally a course, a year level and a response limit. Laid out like the profile form:
// one panel, a numbered row per part (the number turns into a check once the part is filled
// in), and a bar counting the required details. Checked with the API's own schema; errors
// show once Create is pressed, then follow each change. The page closes the form once a link
// is made and passes the school back in `school`, so the next form starts with it.

const props = defineProps<{
  creating: boolean
  error: string | null
  cancellable: boolean
  /** Filled in to start with: the school of the last link made. */
  school?: string
}>()
const emit = defineEmits<{ submit: [input: SchoolLinkInput]; cancel: [] }>()

const form = reactive({
  school: props.school ?? '',
  label: '',
  course: null as Course | null,
  yearLevel: null as YearLevel | null,
  maxResponses: '',
  expiresOn: null as string | null,
})

const today = useToday()
const lastDay = computed(() => addDays(today.value, LINK_MAX_DAYS))
const thisYear = computed(() => Number(today.value.slice(0, 4)))

const COURSE_OPTIONS: { value: Course | null; label: string }[] = [
  { value: null, label: 'Any course' },
  ...COURSES.map((course) => ({ value: course, label: course })),
]

// A course limits the year levels; a year level the new course doesn't have is cleared.
const years = computed(() => (form.course ? yearLevelsFor(form.course) : [...YEAR_LEVELS]))
const yearOptions = computed<{ value: YearLevel | null; label: string }[]>(() => [
  { value: null, label: 'Any year level' },
  ...years.value.map((year) => ({ value: year, label: YEAR_LEVEL_LABELS[year] })),
])
watch(
  () => form.course,
  () => {
    if (form.yearLevel && !years.value.includes(form.yearLevel)) form.yearLevel = null
  },
)

const input = computed<SchoolLinkInput>(() => {
  const limit = form.maxResponses.trim()
  return {
    school: form.school,
    label: form.label,
    course: form.course,
    yearLevel: form.yearLevel,
    maxResponses: limit === '' ? null : Number(limit),
    expiresOn: form.expiresOn ?? '',
  }
})

const result = computed(() => {
  void today.value // read first, so a new day checks the date again
  return schoolLinkSchema.safeParse(input.value)
})

type Field = keyof SchoolLinkInput

/** The first problem with each field, shown or not. */
const issues = computed(() => {
  const found: Partial<Record<Field, string>> = {}
  if (result.value.success) return found
  for (const issue of result.value.error.issues) {
    const field = issue.path[0] as Field | undefined
    if (field && !found[field]) found[field] = issue.message
  }
  return found
})

const tried = ref(false)
const errors = computed(() => (tried.value ? issues.value : {}))

const ok = (...fields: Field[]) => fields.every((field) => !issues.value[field])

const REQUIRED: Field[] = ['school', 'label', 'expiresOn']
const requiredDone = computed(() => REQUIRED.filter((field) => ok(field)).length)

const footerNote = computed(() => {
  if (result.value.success) return 'Ready to create.'
  if (requiredDone.value < REQUIRED.length)
    return `Fill in the ${REQUIRED.length} required details to make the link.`
  // Only an optional detail is wrong, like a response limit that isn't a number.
  return tried.value ? 'Fix what’s marked above.' : 'Check the optional details.'
})

const done = computed(() => ({
  class: ok('school', 'label'),
  // Optional: checked once a course or year level is picked.
  who: (form.course !== null || form.yearLevel !== null) && ok('yearLevel'),
  open: ok('expiresOn', 'maxResponses'),
}))

const confirmation = computed(() =>
  form.expiresOn && ok('expiresOn')
    ? `It closes at midnight after ${formatIsoDay(form.expiresOn)}.`
    : null,
)

function submit() {
  tried.value = true
  if (result.value.success) emit('submit', input.value)
}
</script>

<template>
  <form
    novalidate
    aria-labelledby="new-link-heading"
    class="divide-y divide-line rounded-card border border-line bg-surface"
    @submit.prevent="submit"
  >
    <header
      class="flex flex-col gap-5 px-5 py-6 sm:px-7 sm:py-7 md:flex-row md:items-center md:justify-between"
    >
      <div class="flex items-center gap-4">
        <span
          class="grid size-12 shrink-0 place-items-center rounded-card bg-evergreen-soft text-evergreen"
        >
          <StrokeIcon :d="ICONS.link" class="size-7" />
        </span>
        <div>
          <h2 id="new-link-heading" class="text-2xl leading-tight font-bold">New school link</h2>
          <p class="text-quiet">
            Students who open it go through the school privacy notice and a profile with their
            student number, course and year level.
          </p>
        </div>
      </div>

      <div class="md:w-64 md:shrink-0">
        <p class="flex justify-between gap-4 text-sm font-semibold text-quiet">
          <span>Required details</span>
          <span class="text-ink">{{ requiredDone }} of {{ REQUIRED.length }}</span>
        </p>
        <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
          <div
            class="h-full rounded-full bg-evergreen transition-[width] duration-500 ease-glide"
            :style="{ width: `${(requiredDone / REQUIRED.length) * 100}%` }"
          />
        </div>
      </div>
    </header>

    <FormSection
      :number="1"
      title="The class"
      description="The school, and a name so you can find this link later."
      :done="done.class"
    >
      <TextField
        v-model="form.school"
        label="School"
        hint="The school the students are from."
        :error="errors.school"
        :maxlength="LINK_SCHOOL_MAX_LENGTH"
        autocomplete="organization"
      />
      <TextField
        v-model="form.label"
        label="Link name"
        hint="So you can tell links apart, like BSIT 2A."
        :error="errors.label"
        :maxlength="LINK_LABEL_MAX_LENGTH"
        autocomplete="off"
      />
    </FormSection>

    <FormSection
      :number="2"
      title="Who can use it"
      description="Optional. Leave both on Any to let in every student from the school."
      :done="done.who"
    >
      <SelectField
        v-model="form.course"
        label="Course"
        hint="Only students in this course can use it."
        :options="COURSE_OPTIONS"
      />
      <SelectField
        v-model="form.yearLevel"
        label="Year level"
        hint="Only students in this year can use it."
        :error="errors.yearLevel"
        :options="yearOptions"
      />
    </FormSection>

    <FormSection
      :number="3"
      title="How long it’s open"
      description="When the link stops letting new students start."
      :done="done.open"
    >
      <DateField
        v-model="form.expiresOn"
        label="Last day open"
        :hint="`Type it as MM/DD/YYYY, or pick it on the calendar. Up to ${LINK_MAX_DAYS} days from today.`"
        :error="errors.expiresOn"
        :confirmation="confirmation"
        :min="today"
        :max="lastDay"
        :start-year="thisYear"
      />
      <TextField
        v-model="form.maxResponses"
        label="Response limit"
        :hint="`Optional. The most students who can start from it, up to ${LINK_MAX_RESPONSES}. Leave it empty for no limit.`"
        :error="errors.maxResponses"
        inputmode="numeric"
        autocomplete="off"
      />
    </FormSection>

    <footer
      class="flex flex-col gap-4 rounded-b-card bg-mist-soft px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7"
    >
      <p v-if="error" role="alert" class="font-semibold text-error">{{ error }}</p>
      <p v-else class="text-quiet">{{ footerNote }}</p>

      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:shrink-0">
        <button
          v-if="cancellable"
          type="button"
          :class="SECONDARY_BUTTON"
          :disabled="creating"
          @click="emit('cancel')"
        >
          Cancel
        </button>
        <button type="submit" :class="PRIMARY_BUTTON" :disabled="creating">
          {{ creating ? 'Creating…' : 'Create link' }}
        </button>
      </div>
    </footer>
  </form>
</template>
