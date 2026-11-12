<script setup lang="ts">
import { AREA_LABELS, statsGroupSchema, type StatsGroup } from '@digibridge/shared'
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ICONS } from '../../components/admin/admin-icons'
import ComparisonChart from '../../components/admin/ComparisonChart.vue'
import ErrorPanel from '../../components/admin/ErrorPanel.vue'
import FilterBar from '../../components/admin/FilterBar.vue'
import LevelDistribution from '../../components/admin/LevelDistribution.vue'
import { durationText } from '../../components/admin/respondent-text'
import { countText, pctText } from '../../components/admin/stats-text'
import StrokeIcon from '../../components/admin/StrokeIcon.vue'
import SusSummary from '../../components/admin/SusSummary.vue'
import SkeletonText from '../../components/results/SkeletonText.vue'
import { useAdminStats } from '../../composables/useAdminStats'
import { useDashboardFilters } from '../../composables/useDashboardFilters'
import { useSchoolLinks } from '../../composables/useSchoolLinks'
import { SECONDARY_BUTTON } from '../../lib/buttons'
import { useSessionStore } from '../../stores/session'

// The analysis page (DSH-01 to DSH-04, SUS-05), staff only: summary cards, levels per area, the
// average score by a chosen grouping and the usability survey, all following the dashboard
// filters. The grouping is kept in the URL (`groupBy`) with the filters. Scores count finished
// attempts only.
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const { filters } = useDashboardFilters()
const { stats, error, loading, load } = useAdminStats()

const schoolLinks = useSchoolLinks()
onMounted(() => {
  if (session.isAdmin) void schoolLinks.load()
})

const groupBy = computed<StatsGroup>({
  get: () => statsGroupSchema.safeParse(route.query.groupBy).data ?? 'mode',
  set: (value) =>
    void router.replace({
      query: { ...route.query, groupBy: value === 'mode' ? undefined : value },
    }),
})

const query = computed(() => ({ ...filters.value, groupBy: groupBy.value }))
watch(
  () => JSON.stringify(query.value),
  () => load(query.value),
  { immediate: true },
)
const reload = () => load(query.value)

type Tile = { label: string; value: string | null; note: string | null }
const tiles = computed<Tile[]>(() => {
  const s = stats.value
  return [
    {
      label: 'Respondents',
      value: s && s.respondents.toLocaleString('en-US'),
      note: 'Saved a profile',
    },
    {
      label: 'Completion rate',
      value: s && pctText(s.completionRate),
      note: s && `${countText(s.finished, 'finished', 'finished')} of ${s.respondents}`,
    },
    {
      label: 'Average score',
      value: s && pctText(s.averageOverallPct),
      note: 'Overall, finished only',
    },
    {
      label: 'Median time',
      value:
        s && (s.medianTimeSeconds === null ? '—' : durationText(Math.round(s.medianTimeSeconds))),
      note: 'From start to submit',
    },
    {
      label: 'Mean SUS score',
      value: s && (s.sus.mean === null ? '—' : String(s.sus.mean)),
      note: s && countText(s.sus.responses, 'response', 'responses'),
    },
  ]
})
</script>

<template>
  <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 class="text-3xl leading-tight font-bold sm:text-4xl">Analysis</h1>
      <p class="mt-2 max-w-2xl text-lg text-quiet">
        How respondents did, who is falling behind, and what they thought of DigiBridge. Scores
        count finished attempts only.
      </p>
    </div>
    <button
      type="button"
      :class="SECONDARY_BUTTON"
      class="shrink-0 self-start sm:self-auto"
      :disabled="loading"
      @click="reload"
    >
      <StrokeIcon
        :d="ICONS.refresh"
        class="size-5"
        :class="{ 'motion-safe:animate-spin': loading }"
      />
      {{ loading ? 'Refreshing…' : 'Refresh' }}
    </button>
  </div>

  <FilterBar class="mt-8" :links="session.isAdmin ? (schoolLinks.links.value ?? []) : null" />

  <ErrorPanel
    v-if="error"
    class="mt-4"
    :message="stats ? `We couldn’t refresh the numbers. ${error}` : error"
    @retry="reload"
  />

  <template v-if="stats || !error">
    <dl class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5" :aria-busy="!stats">
      <div
        v-for="tile in tiles"
        :key="tile.label"
        class="flex flex-col rounded-card border border-line bg-surface p-5"
      >
        <dt class="font-semibold text-quiet">{{ tile.label }}</dt>
        <dd class="mt-3 font-display text-3xl leading-none font-bold tabular-nums">
          <template v-if="tile.value !== null">{{ tile.value }}</template>
          <template v-else>
            <SkeletonText class="w-[2.5em]" />
            <span class="sr-only">Loading</span>
          </template>
        </dd>
        <dd class="mt-2 truncate text-sm text-quiet">
          <template v-if="tile.note">{{ tile.note }}</template>
          <SkeletonText v-else class="w-24" />
        </dd>
      </div>
    </dl>

    <dl class="mt-4 grid gap-4 md:grid-cols-3">
      <div
        v-for="(area, i) in stats?.areas ?? [null, null, null]"
        :key="area?.area ?? i"
        class="rounded-card border border-line bg-surface p-5"
      >
        <dt class="font-semibold text-quiet">
          <template v-if="area">Average in {{ AREA_LABELS[area.area] }}</template>
          <SkeletonText v-else class="w-48" />
        </dt>
        <dd class="mt-2 font-display text-2xl font-bold tabular-nums">
          <template v-if="area">{{ pctText(area.averagePct) }}</template>
          <SkeletonText v-else class="w-[2.5em]" />
        </dd>
      </div>
    </dl>

    <section
      aria-labelledby="levels-heading"
      class="mt-4 rounded-card border border-line bg-surface p-5 sm:p-6"
    >
      <h2 id="levels-heading" class="text-lg font-bold">Levels reached</h2>
      <p class="mt-1 text-quiet">How many finished at each level, overall and in each area.</p>
      <LevelDistribution
        v-if="stats"
        class="mt-5"
        :overall="stats.overallLevels"
        :areas="stats.areas"
      />
      <div
        v-else
        class="mt-5 h-48 rounded-card bg-skeleton motion-safe:animate-skeleton"
        aria-hidden="true"
      />
    </section>

    <section
      aria-labelledby="compare-heading"
      class="mt-4 rounded-card border border-line bg-surface p-5 sm:p-6"
    >
      <h2 id="compare-heading" class="text-lg font-bold">Compare groups</h2>
      <p class="mt-1 text-quiet">The average score of each group, to see who is falling behind.</p>
      <ComparisonChart
        v-if="stats"
        v-model:group-by="groupBy"
        class="mt-5"
        :comparison="stats.comparison"
      />
      <div
        v-else
        class="mt-5 h-48 rounded-card bg-skeleton motion-safe:animate-skeleton"
        aria-hidden="true"
      />
    </section>

    <section
      aria-labelledby="sus-heading"
      class="mt-4 rounded-card border border-line bg-surface p-5 sm:p-6"
    >
      <h2 id="sus-heading" class="text-lg font-bold">Usability survey (SUS)</h2>
      <p class="mt-1 text-quiet">What respondents thought of DigiBridge after their results.</p>
      <SusSummary v-if="stats" class="mt-5" :sus="stats.sus" />
      <div
        v-else
        class="mt-5 h-48 rounded-card bg-skeleton motion-safe:animate-skeleton"
        aria-hidden="true"
      />
    </section>
  </template>
</template>
