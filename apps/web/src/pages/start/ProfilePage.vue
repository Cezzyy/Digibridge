<script setup lang="ts">
import {
  COURSES,
  DEVICE_LABELS,
  DEVICES,
  FULL_NAME_MAX_LENGTH,
  INTERNET_ACCESS,
  INTERNET_ACCESS_LABELS,
  isYearLevelInCourse,
  normalizeFullName,
  onlineRespondentSchema,
  schoolRespondentSchema,
  SEX_LABELS,
  SEXES,
  STUDENT_NUMBER_EXAMPLE,
  yearLevelLabel,
  YEAR_LEVELS,
  yearLevelsFor,
  type Course,
  type Device,
  type InternetAccess,
  type Sex,
  type YearLevel,
} from '@digibridge/shared'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import FixedField from '../../components/form/FixedField.vue'
import SelectField from '../../components/form/SelectField.vue'
import TextField from '../../components/form/TextField.vue'
import BirthDateField from '../../components/start/BirthDateField.vue'
import {
  DEVICE_ICONS,
  IDENTITY_ICONS,
  INTERNET_ACCESS_ICONS,
} from '../../components/start/choice-icons'
import FormSection from '../../components/start/FormSection.vue'
import LinkTag from '../../components/start/LinkTag.vue'
import OptionGroup, { type Option } from '../../components/start/OptionGroup.vue'
import StartLayout from '../../components/start/StartLayout.vue'
import StartSteps from '../../components/start/StartSteps.vue'
import { useCreateRespondent } from '../../composables/useCreateRespondent'
import { useJoinLink } from '../../composables/useJoinLink'
import { useRespondentFlow } from '../../composables/useRespondentFlow'
import { useToday } from '../../composables/useToday'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../lib/buttons'
import { useConsentStore } from '../../stores/consent'
import { useSchoolLinkStore } from '../../stores/schoolLink'
import { useSessionStore } from '../../stores/session'

// The profile (PRO-01) and the show-identity choice (PRO-05). Online it's the general profile
// only: online never asks for school details (PRO-06). Through a school link it adds student
// number, course and year level (LNK-03); a link made for one course or year level fills that in
// and the student can't change it. Saving sends the consent from the previous page with it,
// which the `step` guard makes sure exists. Staff get a preview, online and through a link: the
// answers are checked but not saved, so their tries stay out of the research data and don't
// take a place on a link.
const session = useSessionStore()
const school = useSchoolLinkStore()
const flow = useRespondentFlow()
const consent = useConsentStore()
const router = useRouter()
const online = useCreateRespondent()
const joining = useJoinLink()

// The page is opened for one mode and stays in it: online and school links have their own routes.
const isSchool = flow.isSchool.value
const preview = flow.preview
const saving = computed(() => online.saving.value || joining.saving.value)
const saveError = computed(() => online.error.value ?? joining.error.value)

// The link's course and year-level lock (null for any).
const lock = {
  course: (school.link?.course ?? null) as Course | null,
  yearLevel: (school.link?.yearLevel ?? null) as YearLevel | null,
}

const googleName = isSchool ? '' : (session.me?.profile.fullName ?? '')
const form = reactive({
  fullName: googleName,
  birthDate: null as string | null,
  sex: null as Sex | null,
  studentNumber: '',
  course: lock.course,
  yearLevel: lock.yearLevel,
  devices: [] as Device[],
  internetAccess: [] as InternetAccess[],
  showIdentity: null as boolean | null,
})

const sexOptions: Option<Sex>[] = SEXES.map((value) => ({ value, label: SEX_LABELS[value] }))
const deviceOptions: Option<Device>[] = DEVICES.map((value) => ({
  value,
  label: DEVICE_LABELS[value],
  icon: DEVICE_ICONS[value],
}))
const internetOptions: Option<InternetAccess>[] = INTERNET_ACCESS.map((value) => ({
  value,
  label: INTERNET_ACCESS_LABELS[value],
  icon: INTERNET_ACCESS_ICONS[value],
}))

// Only the courses that have the link's year level, and only the year levels the course has.
const courseOptions = COURSES.filter(
  (course) => lock.yearLevel === null || isYearLevelInCourse(course, lock.yearLevel),
).map((course) => ({ value: course as Course | null, label: course }))
const yearOptions = computed(() =>
  (form.course ? yearLevelsFor(form.course) : [...YEAR_LEVELS]).map((year) => ({
    value: year as YearLevel | null,
    label: yearLevelLabel(year),
  })),
)
// A course that doesn't go up to the year picked clears it, so the student picks again.
watch(
  () => form.course,
  (course) => {
    if (lock.yearLevel === null && course && form.yearLevel !== null) {
      if (!isYearLevelInCourse(course, form.yearLevel)) form.yearLevel = null
    }
  },
)

const who = isSchool ? 'your name and student number' : 'your name'
const identityOptions: Option<boolean>[] = [
  {
    value: true,
    label: 'Yes, show my name',
    hint: `The DigiBridge team sees ${who} with your answers.`,
    icon: IDENTITY_ICONS.show,
  },
  {
    value: false,
    label: 'No, hide my name',
    hint: `The team still sees your answers, but ${who} ${isSchool ? 'show' : 'shows'} as Hidden.`,
    icon: IDENTITY_ICONS.hide,
  },
]

// The birth date checks read the clock, so reading `today` runs them again on a new day.
const today = useToday()
const consentVersion = () => {
  const key = flow.consentKey.value
  return key ? consent.versionFor(key) : null
}
const general = () => ({
  fullName: form.fullName,
  birthDate: form.birthDate ?? undefined,
  sex: form.sex ?? undefined,
  devices: form.devices,
  internetAccess: form.internetAccess,
  showIdentity: form.showIdentity ?? undefined,
  consentVersion: consentVersion(),
})
const onlineResult = computed(() => {
  void today.value
  return isSchool ? null : onlineRespondentSchema.safeParse(general())
})
const schoolResult = computed(() => {
  void today.value
  if (!isSchool) return null
  return schoolRespondentSchema.safeParse({
    ...general(),
    studentNumber: form.studentNumber,
    course: form.course ?? undefined,
    yearLevel: form.yearLevel ?? undefined,
  })
})
const result = computed(() => (isSchool ? schoolResult.value : onlineResult.value)!)

// Each answer's error shows once the student has left or answered that question, or tried to
// save, and then follows the answer as it changes.
const tried = ref(false)
type Field = keyof typeof form
const touched = reactive(new Set<Field>())
const touch = (field: Field) => touched.add(field)
for (const field of [
  'sex',
  'course',
  'yearLevel',
  'devices',
  'internetAccess',
  'showIdentity',
] as const) {
  watch(
    () => form[field],
    () => touch(field),
  )
}

// Leaving the name box tidies it the way the API saves it: no extra spaces.
function leaveName() {
  form.fullName = normalizeFullName(form.fullName)
  touch('fullName')
}

// Likewise the student number: capitals, no spaces around it.
function leaveStudentNumber() {
  form.studentNumber = form.studentNumber.trim().toUpperCase()
  touch('studentNumber')
}

/** The first message for each field (or the form), whether shown yet or not. */
const issues = computed(() => {
  const byField: Partial<Record<Field | 'form', string>> = {}
  if (result.value.success) return byField
  for (const issue of result.value.error.issues) {
    const field = issue.path[0]
    const key = typeof field === 'string' && field in form ? (field as Field) : 'form'
    byField[key] ??= issue.message
  }
  return byField
})
const errors = computed(() => {
  const shown: Partial<Record<Field | 'form', string>> = {}
  for (const [key, message] of Object.entries(issues.value) as [Field | 'form', string][]) {
    if (tried.value || (key !== 'form' && touched.has(key))) shown[key] = message
  }
  return shown
})
const fieldErrorCount = computed(() => Object.keys(errors.value).filter((k) => k !== 'form').length)

// The form's sections, for the side panel's links and the check mark on each finished one.
// A question counts as answered once its answer passes the checks. The school details come
// second, through a link only.
type Section = { id: string; title: string; fields: readonly Field[] }
const SECTIONS: Section[] = [
  { id: 'profile-about', title: 'About you', fields: ['fullName', 'birthDate', 'sex'] },
  ...(isSchool
    ? [
        {
          id: 'profile-school',
          title: 'Your school',
          fields: ['studentNumber', 'course', 'yearLevel'],
        } satisfies Section,
      ]
    : []),
  { id: 'profile-devices', title: 'Devices and internet', fields: ['devices', 'internetAccess'] },
  { id: 'profile-privacy', title: 'Your privacy', fields: ['showIdentity'] },
]
const QUESTION_COUNT = SECTIONS.reduce((sum, section) => sum + section.fields.length, 0)
/** Each section's number in the form, which shifts by one through a school link. */
const numberOf = (id: string) => SECTIONS.findIndex((section) => section.id === id) + 1

const answeredIn = (fields: readonly Field[]) => fields.filter((f) => !issues.value[f]).length
const sections = computed(() =>
  SECTIONS.map((section) => {
    const answered = answeredIn(section.fields)
    return { ...section, answered, done: answered === section.fields.length }
  }),
)
const answered = computed(() => sections.value.reduce((sum, s) => sum + s.answered, 0))
const doneIn = (id: string) => sections.value.find((s) => s.id === id)?.done ?? false

async function submit() {
  tried.value = true
  if (!result.value.success) {
    await nextTick()
    // Move to the first question that needs an answer.
    const first = document.querySelector<HTMLElement>(
      '[data-invalid] input, [data-invalid] [role="combobox"], input[aria-invalid="true"]',
    )
    first?.focus()
    return
  }
  if (preview.value) {
    consent.clear()
    await router.replace(flow.page('home'))
    return
  }
  const saved =
    schoolResult.value?.success && school.code
      ? await joining.save(school.code, schoolResult.value.data)
      : onlineResult.value?.success
        ? await online.save(onlineResult.value.data)
        : false
  if (saved) await router.replace(flow.page('home'))
}
</script>

<template>
  <StartLayout>
    <template #rail>
      <!-- Phones show the step bar above the heading; desktops list the steps under it. -->
      <StartSteps current="profile" class="mb-6 lg:order-1 lg:mt-10 lg:mb-0" />
      <LinkTag />

      <h1
        class="text-[clamp(2rem,1.5rem+1.6vw,3.25rem)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance motion-safe:animate-rise"
      >
        Tell us a bit about you
      </h1>
      <p
        class="mt-3 text-lg leading-relaxed text-white/85 lg:mt-4 motion-safe:animate-rise motion-safe:[animation-delay:80ms]"
      >
        This helps us see who needs more help with digital skills. There are no right or wrong
        answers here.
      </p>

      <!-- Desktops: how far along the form is, with a link to each section. -->
      <nav
        aria-label="Profile sections"
        class="mt-auto hidden pt-10 lg:order-2 lg:block motion-safe:animate-rise motion-safe:[animation-delay:160ms]"
      >
        <p class="flex justify-between gap-4 text-sm font-semibold text-white/80">
          <span>Your answers</span>
          <span>{{ answered }} of {{ QUESTION_COUNT }}</span>
        </p>
        <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
          <div
            class="h-full rounded-full bg-marigold transition-[width] duration-500 ease-glide"
            :style="{ width: `${(answered / QUESTION_COUNT) * 100}%` }"
          />
        </div>
        <ul class="mt-3 -mx-3 space-y-0.5">
          <li v-for="(section, i) in sections" :key="section.id">
            <a
              :href="`#${section.id}`"
              class="flex min-h-11 items-center gap-3 rounded-control px-3 py-2 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
            >
              <span
                aria-hidden="true"
                class="grid size-7 shrink-0 place-items-center rounded-full border-2 font-display text-sm font-bold transition-colors duration-300"
                :class="
                  section.done
                    ? 'border-white bg-white text-evergreen'
                    : 'border-white/40 text-white/85'
                "
              >
                <svg
                  v-if="section.done"
                  viewBox="0 0 16 16"
                  class="size-3.5 fill-none stroke-current stroke-[2.5]"
                >
                  <path d="M3.5 8.5l3 3 6-7" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <template v-else>{{ i + 1 }}</template>
              </span>
              <span class="min-w-0 flex-1 font-semibold">{{ section.title }}</span>
              <span class="text-sm text-white/80">
                <template v-if="section.done">Done</template>
                <template v-else>{{ section.answered }} of {{ section.fields.length }}</template>
              </span>
            </a>
          </li>
        </ul>
      </nav>
    </template>

    <header
      class="flex items-center gap-4 motion-safe:animate-rise motion-safe:[animation-delay:120ms]"
    >
      <span class="grid size-12 shrink-0 place-items-center rounded-card bg-evergreen-soft">
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          class="size-7 fill-none stroke-evergreen stroke-2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
          <path d="M4 20a8 8 0 0 1 16 0" />
        </svg>
      </span>
      <div>
        <h2 class="text-2xl leading-tight font-bold sm:text-3xl">Your profile</h2>
        <p class="text-quiet">
          {{ QUESTION_COUNT }} questions in {{ SECTIONS.length }} parts. Only the DigiBridge team
          sees your answers.
        </p>
      </div>
    </header>

    <p v-if="preview" role="note" class="mt-6 rounded-control bg-evergreen-soft px-4 py-3">
      <span class="font-semibold text-evergreen">This is a preview.</span>
      You’re signed in as staff, so nothing you enter here is saved.
    </p>

    <!-- One panel, one row per part, read top to bottom (like the privacy notice). -->
    <form
      id="profile-form"
      novalidate
      class="mt-6 divide-y divide-line rounded-card border border-line bg-surface motion-safe:animate-rise motion-safe:[animation-delay:160ms]"
      @submit.prevent="submit"
    >
      <FormSection
        id="profile-about"
        :number="numberOf('profile-about')"
        title="About you"
        description="Your name, date of birth and sex."
        :done="doneIn('profile-about')"
      >
        <!-- Side by side from xl, the two fields share rows (subgrid), so their boxes line up
             even when one hint takes two lines. -->
        <div class="grid gap-8 xl:grid-cols-2 xl:grid-rows-[repeat(4,auto)] xl:gap-x-6 xl:gap-y-0">
          <TextField
            v-model="form.fullName"
            label="Full name"
            :hint="
              googleName
                ? 'We filled this in from Google. Change it if it isn’t your real name.'
                : 'Your first and last name.'
            "
            autocomplete="name"
            :maxlength="FULL_NAME_MAX_LENGTH"
            :error="errors.fullName"
            :valid="touched.has('fullName') && !issues.fullName"
            class="xl:row-span-4 xl:grid xl:grid-rows-subgrid"
            @touch="leaveName"
          >
            <template #icon>
              <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
              <path d="M4 20a8 8 0 0 1 16 0" />
            </template>
          </TextField>

          <BirthDateField
            v-model="form.birthDate"
            :error="errors.birthDate"
            class="xl:row-span-4 xl:grid xl:grid-rows-subgrid"
            @touch="touch('birthDate')"
          />
        </div>

        <OptionGroup
          v-model="form.sex"
          legend="Sex"
          :options="sexOptions"
          :columns="3"
          :error="errors.sex"
        />
      </FormSection>

      <!-- Through a school link only (LNK-03). -->
      <FormSection
        v-if="isSchool"
        id="profile-school"
        :number="numberOf('profile-school')"
        title="Your school"
        description="Your student number, course and year level."
        :done="doneIn('profile-school')"
      >
        <TextField
          v-model="form.studentNumber"
          label="Student number"
          :hint="`Type it with the dashes, like ${STUDENT_NUMBER_EXAMPLE}.`"
          autocomplete="off"
          :maxlength="STUDENT_NUMBER_EXAMPLE.length + 2"
          :error="errors.studentNumber"
          :valid="touched.has('studentNumber') && !issues.studentNumber"
          @touch="leaveStudentNumber"
        >
          <template #icon>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M7 10h4M7 14h6" />
            <circle cx="16.5" cy="11" r="1.5" />
          </template>
        </TextField>

        <div class="grid gap-8 xl:grid-cols-2 xl:gap-x-6">
          <FixedField
            v-if="lock.course"
            label="Course"
            :value="lock.course"
            hint="Your link is for this course."
          />
          <SelectField
            v-else
            v-model="form.course"
            label="Course"
            placeholder="Pick your course"
            :options="courseOptions"
            :error="errors.course"
          />
          <FixedField
            v-if="lock.yearLevel"
            label="Year level"
            :value="yearLevelLabel(lock.yearLevel)"
            hint="Your link is for this year level."
          />
          <SelectField
            v-else
            v-model="form.yearLevel"
            label="Year level"
            placeholder="Pick your year level"
            :options="yearOptions"
            :error="errors.yearLevel"
          />
        </div>
      </FormSection>

      <FormSection
        id="profile-devices"
        :number="numberOf('profile-devices')"
        title="Your devices and internet"
        description="So we can see how people get online."
        :done="doneIn('profile-devices')"
      >
        <OptionGroup
          v-model="form.devices"
          legend="Which devices do you own?"
          hint="Pick all that apply."
          :options="deviceOptions"
          multiple
          exclusive="none"
          :columns="2"
          :error="errors.devices"
        />

        <OptionGroup
          v-model="form.internetAccess"
          legend="How do you usually get internet?"
          hint="Pick all that apply."
          :options="internetOptions"
          multiple
          exclusive="none"
          :columns="2"
          :error="errors.internetAccess"
        />
      </FormSection>

      <FormSection
        id="profile-privacy"
        :number="numberOf('profile-privacy')"
        title="Your privacy"
        description="Either way, your answers count the same."
        :done="doneIn('profile-privacy')"
      >
        <OptionGroup
          v-model="form.showIdentity"
          :legend="`May the DigiBridge team see ${who}?`"
          :options="identityOptions"
          :columns="2"
          :error="errors.showIdentity"
        />
      </FormSection>
    </form>

    <template #actions>
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8">
        <div class="min-w-0 md:flex-1">
          <p
            v-if="saveError || errors.form"
            role="alert"
            class="rounded-control bg-error-soft px-4 py-3 text-error"
          >
            {{ saveError ?? errors.form }}
          </p>
          <p
            v-else-if="tried && fieldErrorCount > 0"
            role="alert"
            class="rounded-control bg-error-soft px-4 py-3 text-error"
          >
            {{
              fieldErrorCount === 1
                ? 'One answer needs fixing. It’s marked in red.'
                : `${fieldErrorCount} answers need fixing. They’re marked in red.`
            }}
          </p>
          <div v-else class="max-w-sm">
            <p class="text-sm font-semibold text-quiet">
              {{ answered }} of {{ QUESTION_COUNT }} questions answered
            </p>
            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
              <div
                class="h-full rounded-full bg-evergreen transition-[width] duration-500 ease-glide"
                :style="{ width: `${(answered / QUESTION_COUNT) * 100}%` }"
              />
            </div>
          </div>
        </div>

        <div class="flex shrink-0 flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <RouterLink :to="flow.page('consent')" :class="SECONDARY_BUTTON">
            Back to the notice
          </RouterLink>
          <button type="submit" form="profile-form" :class="PRIMARY_BUTTON" :disabled="saving">
            <svg
              v-if="saving"
              viewBox="0 0 24 24"
              aria-hidden="true"
              class="size-5 fill-none stroke-current stroke-[3] motion-safe:animate-spin"
            >
              <path d="M12 3a9 9 0 1 0 9 9" stroke-linecap="round" />
            </svg>
            {{ preview ? 'Finish preview' : saving ? 'Saving…' : 'Save and continue' }}
          </button>
        </div>
      </div>
    </template>
  </StartLayout>
</template>
