<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAdminOverview } from '../../composables/useAdminOverview'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../lib/buttons'
import { useSessionStore } from '../../stores/session'

// Where staff land after signing in: a few counts while the full dashboard (charts, filters,
// the respondents table) is still to come. Admins also get a way to the school links page.
const session = useSessionStore()
const { overview, error, load } = useAdminOverview()
onMounted(load)

const firstName = computed(() => session.me?.profile.fullName?.split(' ')[0] ?? null)

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many)

const stats = computed(() => {
  const o = overview.value
  return [
    {
      label: 'Respondents',
      value: o?.respondents.total,
      note: o && `${o.respondents.online} online, ${o.respondents.school} through school links`,
    },
    {
      label: 'Finished',
      value: o?.attempts.finished,
      note: 'Submitted, or ran out of time',
    },
    {
      label: 'In progress',
      value: o?.attempts.inProgress,
      note: 'Taking the assessment now',
    },
    {
      label: 'Open school links',
      value: o?.links.open,
      note: o && `${o.links.total} ${plural(o.links.total, 'link', 'links')} made in all`,
    },
  ]
})
</script>

<template>
  <h1 class="text-3xl leading-tight font-bold sm:text-4xl">Overview</h1>
  <p class="mt-2 text-lg text-quiet">
    {{ firstName ? `Hi, ${firstName}. ` : '' }}Here’s how DigiBridge is doing so far.
  </p>

  <div
    v-if="error"
    role="alert"
    class="mt-8 flex flex-col gap-4 rounded-card bg-error-soft p-5 sm:flex-row sm:items-center sm:justify-between"
  >
    <p class="font-semibold text-error">{{ error }}</p>
    <button type="button" :class="SECONDARY_BUTTON" class="bg-surface" @click="load">
      Try again
    </button>
  </div>

  <dl v-else class="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" :aria-busy="!overview">
    <div
      v-for="stat in stats"
      :key="stat.label"
      class="flex flex-col rounded-card border border-line bg-surface p-5"
    >
      <dt class="font-semibold text-quiet">{{ stat.label }}</dt>
      <dd class="order-first mt-0 mb-1 font-display text-4xl font-bold text-ink tabular-nums">
        <span v-if="stat.value !== undefined">{{ stat.value }}</span>
        <span
          v-else
          class="inline-block h-10 w-16 rounded-control bg-track align-middle motion-safe:animate-pulse"
        >
          <span class="sr-only">Loading</span>
        </span>
      </dd>
      <dd class="mt-1 text-sm text-quiet">
        <span v-if="stat.note">{{ stat.note }}</span>
        <span v-else class="inline-block h-4 w-36 rounded bg-track motion-safe:animate-pulse" />
      </dd>
    </div>
  </dl>

  <section
    v-if="session.isAdmin"
    aria-labelledby="links-heading"
    class="mt-6 flex flex-col gap-4 rounded-card border border-line bg-surface p-6 sm:flex-row sm:items-center sm:justify-between"
  >
    <div>
      <h2 id="links-heading" class="text-xl font-bold">School links</h2>
      <p class="mt-1 text-quiet">
        Make a link for a class, then send it only to the students you choose. They open it without
        signing in.
      </p>
    </div>
    <RouterLink :to="{ name: 'admin-links' }" :class="PRIMARY_BUTTON" class="shrink-0">
      Go to school links
    </RouterLink>
  </section>

  <p class="mt-6 rounded-card bg-mist-soft p-5 text-quiet">
    Coming next: charts by skill area, filters, and the respondents table.
  </p>
</template>
