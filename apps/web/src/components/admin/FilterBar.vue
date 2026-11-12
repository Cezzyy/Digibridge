<script setup lang="ts">
import {
  AGE_GROUP_LABELS,
  AGE_GROUPS,
  COURSES,
  DEVICE_LABELS,
  DEVICES,
  INTERNET_ACCESS,
  INTERNET_ACCESS_LABELS,
  isRealDate,
  MODE_LABELS,
  MODES,
  SEX_LABELS,
  SEXES,
  YEAR_LEVEL_LABELS,
  YEAR_LEVELS,
  type DashboardFilters,
} from '@digibridge/shared'
import { computed, ref, watch } from 'vue'
import { useDashboardFilters } from '../../composables/useDashboardFilters'
import { useToday } from '../../composables/useToday'
import { SECONDARY_BUTTON } from '../../lib/buttons'
import DateField from '../form/DateField.vue'
import SelectField from '../form/SelectField.vue'
import { ICONS } from './admin-icons'
import StrokeIcon from './StrokeIcon.vue'

// The dashboard filters (DSH-03) for the respondents, analysis and item pages. They live in the
// URL (useDashboardFilters), so each page reloads when one changes. The school link list comes
// from the page, for admins only (facilitators can't list links). Folded away on phones until
// opened; always open from `lg`.
const props = defineProps<{ links?: readonly { id: string; label: string }[] | null }>()

const { filters, activeCount, set, clear } = useDashboardFilters()
const open = ref(false)
const today = useToday()

type Option<T> = { value: T | null; label: string }
const ANY = 'Any'
const options = <T extends string | number>(values: readonly T[], labels: Record<T, string>) =>
  [
    { value: null, label: ANY },
    ...values.map((value) => ({ value, label: labels[value] })),
  ] as Option<T>[]

const modeOptions = options(MODES, MODE_LABELS)
const sexOptions = options(SEXES, SEX_LABELS)
const ageOptions = options(AGE_GROUPS, AGE_GROUP_LABELS)
const deviceOptions = options(DEVICES, DEVICE_LABELS)
const internetOptions = options(INTERNET_ACCESS, INTERNET_ACCESS_LABELS)
const courseOptions = options(
  COURSES,
  Object.fromEntries(COURSES.map((c) => [c, c])) as Record<(typeof COURSES)[number], string>,
)
const yearOptions = options(YEAR_LEVELS, YEAR_LEVEL_LABELS)
const linkOptions = computed<Option<string>[]>(() => [
  { value: null, label: ANY },
  ...(props.links ?? []).map((link) => ({ value: link.id, label: link.label })),
])

/** A two-way binding for one filter: reads it from the URL, writes it back. */
function bind<K extends keyof DashboardFilters>(key: K) {
  return computed({
    get: () => (filters.value[key] ?? null) as NonNullable<DashboardFilters[K]> | null,
    set: (value) => void set({ [key]: value }),
  })
}
const mode = bind('mode')
const sex = bind('sex')
const ageGroup = bind('ageGroup')
const device = bind('device')
const internetAccess = bind('internetAccess')
const course = bind('course')
const yearLevel = bind('yearLevel')
const schoolLinkId = bind('schoolLinkId')

// The date fields hold what's typed; only a whole, real date (or a cleared field) filters. When
// the URL's date changes (Clear all, a link), the field takes it, even over half-typed text. A
// value the URL already has isn't written back, so that sync doesn't echo a second navigation.
function dateField(key: 'from' | 'to') {
  const urlValue = () => filters.value[key] ?? null
  const field = ref<string | null>(urlValue())
  watch(urlValue, (value) => {
    if (value !== field.value) field.value = value
  })
  watch(field, (value) => {
    if (value !== urlValue() && (value === null || isRealDate(value))) void set({ [key]: value })
  })
  return field
}
const from = dateField('from')
const to = dateField('to')

const DATE_MIN = '2026-01-01'
</script>

<template>
  <section aria-labelledby="filters-heading" class="rounded-card border border-line bg-surface">
    <div class="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-6">
      <h2 id="filters-heading" class="flex items-center gap-2 text-lg font-bold">
        Filters
        <span
          v-if="activeCount"
          class="rounded-full bg-evergreen-soft px-2.5 text-sm text-evergreen tabular-nums"
        >
          {{ activeCount }} on
        </span>
      </h2>
      <div class="flex gap-2">
        <button v-if="activeCount" type="button" :class="SECONDARY_BUTTON" @click="clear">
          Clear all
        </button>
        <button
          type="button"
          :class="SECONDARY_BUTTON"
          class="lg:hidden"
          :aria-expanded="open"
          aria-controls="filter-fields"
          @click="open = !open"
        >
          {{ open ? 'Hide filters' : 'Show filters' }}
        </button>
      </div>
    </div>

    <div
      id="filter-fields"
      class="border-t border-line p-4 sm:px-6 sm:pb-6 lg:block"
      :class="open ? 'block' : 'hidden'"
    >
      <div class="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField v-model="mode" label="Mode" :options="modeOptions" />
        <SelectField v-model="sex" label="Sex" :options="sexOptions" />
        <SelectField v-model="ageGroup" label="Age group" :options="ageOptions" />
        <SelectField v-model="device" label="Owns" :options="deviceOptions" />
        <SelectField v-model="internetAccess" label="Internet" :options="internetOptions" />
        <SelectField v-model="course" label="Course" :options="courseOptions" />
        <SelectField v-model="yearLevel" label="Year level" :options="yearOptions" />
        <SelectField
          v-if="links"
          v-model="schoolLinkId"
          label="School link"
          :options="linkOptions"
        />
        <DateField
          v-model="from"
          label="Consented from"
          :min="DATE_MIN"
          :max="today"
          :start-year="2026"
        />
        <DateField
          v-model="to"
          label="Consented to"
          :min="DATE_MIN"
          :max="today"
          :start-year="2026"
        />
      </div>
      <p class="mt-4 flex gap-2 text-quiet">
        <StrokeIcon :d="ICONS.school" class="mt-0.5 size-5 shrink-0" />
        Course, year level and school link are asked through school links only, so picking one
        leaves online respondents out.
      </p>
    </div>
  </section>
</template>
