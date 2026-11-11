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
import { computed, reactive, ref, useId, watch } from 'vue'
import { useToday } from '../../composables/useToday'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../lib/buttons'
import DateField from '../form/DateField.vue'
import TextField from '../form/TextField.vue'
import { formatIsoDay } from './link-text'

// Makes a school link (LNK-01): the school, a name for the class, the last day it stays open,
// and optionally a course, a year level and a response limit. Checked with the API's own
// schema; errors show once Create is pressed, then follow each change. After a link is made
// the form clears, but keeps the school for the next one.

defineProps<{ creating: boolean; error: string | null; cancellable: boolean }>()
const emit = defineEmits<{ submit: [input: SchoolLinkInput]; cancel: [] }>()

const blank = () => ({
  label: '',
  course: null as Course | null,
  yearLevel: null as YearLevel | null,
  maxResponses: '',
  expiresOn: null as string | null,
})
const form = reactive({ school: '', ...blank() })

/** Clears the form after a link is made, keeping the school. */
function reset() {
  Object.assign(form, blank())
  tried.value = false
}
defineExpose({ reset })

const today = useToday()
const lastDay = computed(() => addDays(today.value, LINK_MAX_DAYS))
const thisYear = computed(() => Number(today.value.slice(0, 4)))

// A course limits the year levels; a year level the new course doesn't have is cleared.
const yearOptions = computed(() => (form.course ? yearLevelsFor(form.course) : [...YEAR_LEVELS]))
watch(
  () => form.course,
  () => {
    if (form.yearLevel && !yearOptions.value.includes(form.yearLevel)) form.yearLevel = null
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

const tried = ref(false)
const errors = computed(() => {
  const found: Partial<Record<keyof SchoolLinkInput, string>> = {}
  if (!tried.value || result.value.success) return found
  for (const issue of result.value.error.issues) {
    const field = issue.path[0] as keyof SchoolLinkInput | undefined
    if (field && !found[field]) found[field] = issue.message
  }
  return found
})

const confirmation = computed(() =>
  form.expiresOn && result.value.success
    ? `It closes at midnight after ${formatIsoDay(form.expiresOn)}.`
    : null,
)

function submit() {
  tried.value = true
  if (result.value.success) emit('submit', input.value)
}

const id = useId()
const FIELD =
  'block min-h-12 w-full rounded-control border bg-surface px-4 text-lg transition-colors hover:border-evergreen focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-evergreen'
</script>

<template>
  <form
    class="rounded-card border border-line bg-surface p-5 sm:p-7"
    novalidate
    aria-labelledby="new-link-heading"
    @submit.prevent="submit"
  >
    <h2 id="new-link-heading" class="text-xl font-bold">New school link</h2>
    <p class="mt-1 text-quiet">
      Students who open it go through the school privacy notice and a profile with their student
      number, course and year level.
    </p>

    <div class="mt-6 grid gap-6 md:grid-cols-2">
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

      <div>
        <label :for="`${id}-course`" class="text-lg font-semibold">Course</label>
        <p class="mt-0.5 text-quiet">Only students in this course can use it.</p>
        <select
          :id="`${id}-course`"
          v-model="form.course"
          class="mt-2 border-line-strong"
          :class="FIELD"
        >
          <option :value="null">Any course</option>
          <option v-for="course in COURSES" :key="course" :value="course">{{ course }}</option>
        </select>
      </div>

      <div :data-invalid="errors.yearLevel ? '' : undefined">
        <label :for="`${id}-year`" class="text-lg font-semibold">Year level</label>
        <p class="mt-0.5 text-quiet">Only students in this year can use it.</p>
        <select
          :id="`${id}-year`"
          v-model="form.yearLevel"
          class="mt-2"
          :class="[FIELD, errors.yearLevel ? 'border-error' : 'border-line-strong']"
          :aria-invalid="errors.yearLevel ? 'true' : undefined"
          :aria-describedby="errors.yearLevel ? `${id}-year-error` : undefined"
        >
          <option :value="null">Any year level</option>
          <option v-for="year in yearOptions" :key="year" :value="year">
            {{ YEAR_LEVEL_LABELS[year] }}
          </option>
        </select>
        <p v-if="errors.yearLevel" :id="`${id}-year-error`" class="mt-2 font-semibold text-error">
          {{ errors.yearLevel }}
        </p>
      </div>

      <div :data-invalid="errors.maxResponses ? '' : undefined">
        <label :for="`${id}-limit`" class="text-lg font-semibold">Response limit</label>
        <p :id="`${id}-limit-hint`" class="mt-0.5 text-quiet">
          The most students who can start from it, up to {{ LINK_MAX_RESPONSES }}. Leave it empty
          for no limit.
        </p>
        <input
          :id="`${id}-limit`"
          v-model="form.maxResponses"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          class="mt-2"
          :class="[FIELD, errors.maxResponses ? 'border-error' : 'border-line-strong']"
          :aria-invalid="errors.maxResponses ? 'true' : undefined"
          :aria-describedby="`${id}-limit-hint${errors.maxResponses ? ` ${id}-limit-error` : ''}`"
        />
        <p
          v-if="errors.maxResponses"
          :id="`${id}-limit-error`"
          class="mt-2 font-semibold text-error"
        >
          {{ errors.maxResponses }}
        </p>
      </div>

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
    </div>

    <p v-if="error" role="alert" class="mt-6 font-semibold text-error">{{ error }}</p>

    <div class="mt-8 flex flex-col gap-3 sm:flex-row">
      <button type="submit" :class="PRIMARY_BUTTON" :disabled="creating">
        {{ creating ? 'Creating…' : 'Create link' }}
      </button>
      <button
        v-if="cancellable"
        type="button"
        :class="SECONDARY_BUTTON"
        :disabled="creating"
        @click="emit('cancel')"
      >
        Cancel
      </button>
    </div>
  </form>
</template>
