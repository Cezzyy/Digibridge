<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ICONS } from '../../components/admin/admin-icons'
import ErrorPanel from '../../components/admin/ErrorPanel.vue'
import { formatIsoDay } from '../../components/admin/link-text'
import SplitCard, { type SplitPart } from '../../components/admin/SplitCard.vue'
import StrokeIcon from '../../components/admin/StrokeIcon.vue'
import SkeletonText from '../../components/results/SkeletonText.vue'
import { useAdminOverview } from '../../composables/useAdminOverview'
import { useToday } from '../../composables/useToday'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../lib/buttons'
import { useSessionStore } from '../../stores/session'

// Where staff land after signing in: the counts so far, how respondents came in and where their
// attempts stand, while the full dashboard (charts, filters, the respondents table) is still to
// come. Admins also get a way to the school links page. While the counts load, the same cards
// are drawn with placeholders where the numbers go, so nothing moves when they arrive.
const session = useSessionStore()
const { overview, error, loading, load } = useAdminOverview()
onMounted(load)

const firstName = computed(() => session.me?.profile.fullName?.split(' ')[0] ?? null)
const today = useToday()

const number = (n: number) => n.toLocaleString('en-US')

type Stat = {
  label: string
  value: number | undefined
  /** Under the number; null until the counts it needs come in. */
  note: string | null
}

const stats = computed<Stat[]>(() => {
  const o = overview.value
  return [
    {
      label: 'Respondents',
      value: o?.respondents.total,
      note: o && `${number(o.respondents.online)} online · ${number(o.respondents.school)} school`,
    },
    {
      label: 'Finished',
      value: o?.attempts.finished,
      note: 'Submitted or out of time',
    },
    {
      label: 'In progress',
      value: o?.attempts.inProgress,
      note: 'Taking it right now',
    },
    {
      label: 'Open school links',
      value: o?.links.open,
      note: o && `${number(o.links.total)} made in all`,
    },
  ]
})

const byMode = computed<SplitPart[]>(() => [
  { label: 'Online, with Google', value: overview.value?.respondents.online, tone: 'evergreen' },
  { label: 'Through school links', value: overview.value?.respondents.school, tone: 'marigold' },
])

const progress = computed<SplitPart[]>(() => [
  { label: 'Finished', value: overview.value?.attempts.finished, tone: 'evergreen' },
  { label: 'In progress', value: overview.value?.attempts.inProgress, tone: 'marigold' },
])
</script>

<template>
  <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p class="text-sm font-semibold tracking-wide text-quiet uppercase">
        {{ formatIsoDay(today) }}
      </p>
      <h1 class="mt-1 text-3xl leading-tight font-bold sm:text-4xl">Overview</h1>
      <p class="mt-2 text-lg text-quiet">
        {{ firstName ? `Hi, ${firstName}. ` : '' }}Here’s how DigiBridge is doing so far.
      </p>
    </div>
    <button
      type="button"
      :class="SECONDARY_BUTTON"
      class="shrink-0 self-start sm:self-auto"
      :disabled="loading"
      @click="load"
    >
      <StrokeIcon
        :d="ICONS.refresh"
        class="size-5"
        :class="{ 'motion-safe:animate-spin': loading }"
      />
      {{ loading ? 'Refreshing…' : 'Refresh' }}
    </button>
  </div>

  <ErrorPanel
    v-if="error"
    class="mt-8"
    :message="overview ? `We couldn’t refresh the counts. ${error}` : error"
    @retry="load"
  />

  <!-- Without counts and with an error, the alert above takes their place. -->
  <template v-if="overview || !error">
    <dl class="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" :aria-busy="!overview">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="flex flex-col rounded-card border border-line bg-surface p-5"
      >
        <dt class="font-semibold text-quiet">{{ stat.label }}</dt>
        <dd class="mt-3 font-display text-4xl leading-none font-bold tabular-nums">
          <template v-if="stat.value !== undefined">{{ number(stat.value) }}</template>
          <template v-else>
            <SkeletonText class="w-[1.6em]" />
            <span class="sr-only">Loading</span>
          </template>
        </dd>
        <dd class="mt-2 truncate text-sm text-quiet">
          <template v-if="stat.note">{{ stat.note }}</template>
          <SkeletonText v-else class="w-32" />
        </dd>
      </div>
    </dl>

    <div class="mt-4 grid gap-4 lg:grid-cols-2">
      <SplitCard
        title="How they came in"
        description="Respondents by the way they started."
        :parts="byMode"
      />
      <SplitCard
        title="Where attempts stand"
        description="Every attempt started so far."
        :parts="progress"
      />
    </div>
  </template>

  <section
    v-if="session.isAdmin"
    aria-labelledby="links-heading"
    class="mt-4 flex flex-col gap-5 rounded-card border border-line bg-surface p-5 sm:flex-row sm:items-center sm:p-6"
  >
    <span
      aria-hidden="true"
      class="grid size-12 shrink-0 place-items-center rounded-card bg-evergreen-soft text-evergreen"
    >
      <StrokeIcon :d="ICONS.link" class="size-6" />
    </span>
    <div class="min-w-0 flex-1">
      <h2 id="links-heading" class="text-lg leading-tight font-bold">School links</h2>
      <p class="mt-1 text-quiet">
        Make a link for a class, then send it only to the students you choose. They open it without
        signing in.
      </p>
    </div>
    <RouterLink :to="{ name: 'admin-links' }" :class="PRIMARY_BUTTON" class="shrink-0">
      Go to school links
      <StrokeIcon :d="ICONS.arrow" class="size-5" />
    </RouterLink>
  </section>

  <p class="mt-4 rounded-card border border-dashed border-line-strong/60 p-5 text-quiet sm:px-6">
    <span class="font-semibold text-ink">Coming next:</span> charts by skill area, filters, and the
    respondents table.
  </p>
</template>
