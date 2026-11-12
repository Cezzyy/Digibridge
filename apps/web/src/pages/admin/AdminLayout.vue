<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, type RouteLocationRaw } from 'vue-router'
import { ICONS } from '../../components/admin/admin-icons'
import StrokeIcon from '../../components/admin/StrokeIcon.vue'
import { filterQuery, filtersFrom } from '../../composables/useDashboardFilters'
import { useSessionStore } from '../../stores/session'

// The frame of every /admin page, under AppHeader: a menu on the left from `lg`, which stays put
// while the page scrolls, and a row of tabs under the header on smaller screens. School links
// (LNK-01) and Item analysis, which shows the right answers (DSH-08), show for admins only; the
// router keeps facilitators out of both too. Student preview opens /home, where staff can try the
// student steps without saving anything. The pages that take the dashboard filters get the ones
// set now, so they carry over (DSH-03).
const session = useSessionStore()
const route = useRoute()
const filters = computed(() => filterQuery(filtersFrom(route.query)))

type NavItem = { label: string; to: RouteLocationRaw; icon: string | readonly string[] }

const items = computed<NavItem[]>(() => [
  {
    label: 'Overview',
    to: { name: 'admin' },
    icon: ICONS.overview,
  },
  {
    label: 'Respondents',
    to: { name: 'admin-respondents', query: filters.value },
    icon: ICONS.people,
  },
  {
    label: 'Analysis',
    to: { name: 'admin-analysis', query: filters.value },
    icon: ICONS.started,
  },
  ...(session.isAdmin
    ? [
        {
          label: 'Item analysis',
          to: { name: 'admin-items', query: filters.value },
          icon: ICONS.items,
        },
        {
          label: 'School links',
          to: { name: 'admin-links' },
          icon: ICONS.link,
        },
      ]
    : []),
  {
    label: 'Student preview',
    to: { name: 'home' },
    icon: ICONS.preview,
  },
])
</script>

<template>
  <div class="min-h-[calc(100dvh-var(--spacing-header))] lg:flex">
    <nav
      aria-label="Admin"
      class="border-b border-line bg-surface lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0"
    >
      <div class="px-4 sm:px-8 lg:sticky lg:top-header lg:px-4 lg:py-6">
        <p class="hidden px-3 text-sm font-semibold tracking-wide text-quiet uppercase lg:block">
          Admin
        </p>
        <ul class="-mx-1 flex gap-1 overflow-x-auto py-2 lg:mx-0 lg:mt-3 lg:flex-col lg:py-0">
          <li v-for="item in items" :key="item.label" class="shrink-0">
            <!-- RouterLink sets aria-current="page" on the page that's open. -->
            <RouterLink
              :to="item.to"
              class="flex min-h-11 items-center gap-3 rounded-control px-3 font-semibold whitespace-nowrap text-quiet transition-colors hover:bg-mist-soft hover:text-ink aria-[current=page]:bg-evergreen-soft aria-[current=page]:text-evergreen"
            >
              <StrokeIcon :d="item.icon" class="size-5" />
              {{ item.label }}
            </RouterLink>
          </li>
        </ul>
      </div>
    </nav>

    <main class="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div class="mx-auto max-w-5xl">
        <RouterView />
      </div>
    </main>
  </div>
</template>
