<script setup lang="ts">
import {
  RESPONDENT_SORT_LABELS,
  RESPONDENT_SORTS,
  RESPONDENT_STATUS_LABELS,
  RESPONDENT_STATUSES,
  respondentSortSchema,
  respondentStatusSchema,
  type RespondentSort,
  type RespondentStatus,
} from '@digibridge/shared'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import { ICONS } from '../../components/admin/admin-icons'
import ErrorPanel from '../../components/admin/ErrorPanel.vue'
import FilterBar from '../../components/admin/FilterBar.vue'
import RespondentDrawer from '../../components/admin/RespondentDrawer.vue'
import RespondentsTable from '../../components/admin/RespondentsTable.vue'
import RespondentsTableSkeleton from '../../components/admin/RespondentsTableSkeleton.vue'
import StrokeIcon from '../../components/admin/StrokeIcon.vue'
import SelectField from '../../components/form/SelectField.vue'
import TextField from '../../components/form/TextField.vue'
import SkeletonText from '../../components/results/SkeletonText.vue'
import { useDashboardFilters } from '../../composables/useDashboardFilters'
import { useRespondents } from '../../composables/useRespondents'
import { useSchoolLinks } from '../../composables/useSchoolLinks'
import { SECONDARY_BUTTON } from '../../lib/buttons'
import { useSessionStore } from '../../stores/session'

// Everyone who saved a profile (DSH-05), staff only and read only (DSH-07): the dashboard
// filters, a search on shown names and student numbers, status, sort and pages, all kept in the
// URL. A row opens the respondent's details in a drawer (`?respondent=<id>`), so Back closes it.
// Hidden names read Hidden and can't be searched (PRO-05).
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const { filters, activeCount } = useDashboardFilters()
const { page, error, loading, load } = useRespondents()

// Facilitators can't list school links, so only admins get the link filter.
const schoolLinks = useSchoolLinks()
onMounted(() => {
  if (session.isAdmin) void schoolLinks.load()
})

const queryText = (key: string) => {
  const value = route.query[key]
  return (Array.isArray(value) ? value[0] : value) ?? undefined
}

function replaceQuery(patch: LocationQueryRaw) {
  void router.replace({ query: { ...route.query, ...patch } })
}

const status = computed<RespondentStatus | null>({
  get: () => respondentStatusSchema.safeParse(queryText('status')).data ?? null,
  set: (value) => replaceQuery({ status: value ?? undefined, page: undefined }),
})
const sort = computed<RespondentSort>({
  get: () => respondentSortSchema.safeParse(queryText('sort')).data ?? 'newest',
  set: (value) => replaceQuery({ sort: value === 'newest' ? undefined : value, page: undefined }),
})
const pageNumber = computed(() => {
  const n = Number(queryText('page'))
  return Number.isInteger(n) && n > 1 ? n : 1
})
const q = computed(() => queryText('q')?.trim() || undefined)

// The search box writes to the URL a moment after typing stops.
const search = ref(q.value ?? '')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (text) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(
    () => replaceQuery({ q: text.trim() || undefined, page: undefined }),
    300,
  )
})
watch(q, (value) => {
  if ((value ?? '') !== search.value.trim()) search.value = value ?? ''
})
onBeforeUnmount(() => clearTimeout(searchTimer))

const listQuery = computed(() => ({
  ...filters.value,
  status: status.value ?? undefined,
  q: q.value,
  sort: sort.value,
  page: pageNumber.value,
}))
// Keyed on the text of the query, so opening the drawer doesn't reload the list.
watch(
  () => JSON.stringify(listQuery.value),
  () => load(listQuery.value),
  { immediate: true },
)
const reload = () => load(listQuery.value)

const statusOptions = [
  { value: null, label: 'Any status' },
  ...RESPONDENT_STATUSES.map((value) => ({ value, label: RESPONDENT_STATUS_LABELS[value] })),
]
const sortOptions = RESPONDENT_SORTS.map((value) => ({
  value,
  label: RESPONDENT_SORT_LABELS[value],
}))

const range = computed(() => {
  const p = page.value
  if (!p || p.total === 0) return null
  const from = (p.page - 1) * p.pageSize + 1
  return { from, to: Math.min(from + p.respondents.length - 1, p.total), total: p.total }
})
const lastPage = computed(() =>
  page.value ? Math.max(1, Math.ceil(page.value.total / page.value.pageSize)) : 1,
)
const goToPage = (n: number) => replaceQuery({ page: n > 1 ? String(n) : undefined })

const narrowed = computed(() => activeCount.value > 0 || !!status.value || !!q.value)
function clearAll() {
  search.value = ''
  void router.replace({ query: { respondent: route.query.respondent } })
}

const openId = computed(() => queryText('respondent') ?? null)
/** The open respondent's row, when it's on this page: the drawer shapes its placeholders by it. */
const openRow = computed(
  () => page.value?.respondents.find((row) => row.id === openId.value) ?? null,
)
const open = (id: string) => router.push({ query: { ...route.query, respondent: id } })
function closeDrawer() {
  if (openId.value) replaceQuery({ respondent: undefined })
}
</script>

<template>
  <div>
    <h1 class="text-3xl leading-tight font-bold sm:text-4xl">Respondents</h1>
    <p class="mt-2 max-w-2xl text-lg text-quiet">
      Everyone who agreed to the notice and saved a profile. Open one to see their profile and
      scores<template v-if="session.isAdmin">, and the answers they gave</template>.
    </p>
  </div>

  <FilterBar class="mt-8" :links="session.isAdmin ? (schoolLinks.links.value ?? []) : null" />

  <section
    aria-labelledby="table-heading"
    :aria-busy="!page && !error"
    class="mt-4 rounded-card border border-line bg-surface"
  >
    <h2 id="table-heading" class="sr-only">Respondents</h2>
    <div
      class="grid gap-4 border-b border-line p-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-[2fr_1fr_1fr]"
    >
      <TextField
        v-model="search"
        label="Search"
        hint="A shown name or student number"
        inputmode="search"
        :maxlength="100"
      >
        <template #icon><path v-for="d in ICONS.search" :key="d" :d="d" /></template>
      </TextField>
      <SelectField v-model="status" label="Status" hint="Where they are" :options="statusOptions" />
      <SelectField v-model="sort" label="Sort" hint="Order of the list" :options="sortOptions" />
    </div>

    <ErrorPanel v-if="error" class="m-4" :message="error" @retry="reload" />

    <div v-else-if="page?.total === 0" class="p-8 text-center">
      <p class="text-lg font-semibold">
        {{ narrowed ? 'No respondents match these filters.' : 'No one has taken part yet.' }}
      </p>
      <p class="mt-1 text-quiet">
        {{
          narrowed
            ? 'Try fewer filters, or clear them all.'
            : 'Respondents show here once they agree to the notice and save their profile.'
        }}
      </p>
      <button
        v-if="narrowed"
        type="button"
        :class="SECONDARY_BUTTON"
        class="mt-4"
        @click="clearAll"
      >
        Clear filters and search
      </button>
    </div>

    <template v-else>
      <RespondentsTable
        v-if="page"
        :rows="page.respondents"
        :class="{ 'opacity-60': loading }"
        @open="open"
      />
      <template v-else>
        <RespondentsTableSkeleton />
        <p class="sr-only">Loading respondents</p>
      </template>
      <nav
        aria-label="Pages"
        class="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4 sm:px-6"
      >
        <p v-if="range" class="text-quiet tabular-nums" aria-live="polite">
          {{ range.from }}–{{ range.to }} of {{ range.total }}
        </p>
        <p v-else-if="!page" aria-hidden="true"><SkeletonText class="w-[5.5em]" /></p>
        <div class="flex gap-2">
          <button
            type="button"
            :class="SECONDARY_BUTTON"
            :disabled="!page || page.page <= 1 || loading"
            @click="page && goToPage(page.page - 1)"
          >
            <StrokeIcon :d="ICONS.arrow" class="size-5 rotate-180" />
            Previous
          </button>
          <button
            type="button"
            :class="SECONDARY_BUTTON"
            :disabled="!page || page.page >= lastPage || loading"
            @click="page && goToPage(page.page + 1)"
          >
            Next
            <StrokeIcon :d="ICONS.arrow" class="size-5" />
          </button>
        </div>
      </nav>
    </template>
  </section>

  <RespondentDrawer
    :id="openId"
    :preview="openRow"
    :is-admin="session.isAdmin"
    @close="closeDrawer"
  />
</template>
