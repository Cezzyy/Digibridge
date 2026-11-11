<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { useSessionStore } from '../../stores/session'

// The frame of every /admin page, under AppHeader: a menu on the left from `lg`, which stays put
// while the page scrolls, and a row of tabs under the header on smaller screens. Links shows
// for admins only (LNK-01); the router keeps facilitators out of it too. Student preview opens
// /home, where staff can try the student steps without saving anything.
const session = useSessionStore()

type NavItem = { label: string; to: RouteLocationRaw; icon: string[] }

const items = computed<NavItem[]>(() => [
  {
    label: 'Overview',
    to: { name: 'admin' },
    icon: ['M4 13h6V4H4z', 'M14 20h6v-9h-6z', 'M14 4h6v3h-6z', 'M4 17h6v3H4z'],
  },
  ...(session.isAdmin
    ? [
        {
          label: 'School links',
          to: { name: 'admin-links' },
          icon: [
            'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1',
            'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
          ],
        },
      ]
    : []),
  {
    label: 'Student preview',
    to: { name: 'home' },
    icon: [
      'M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z',
      'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    ],
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
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                class="size-5 shrink-0 fill-none stroke-current stroke-[1.75]"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path v-for="d in item.icon" :key="d" :d="d" />
              </svg>
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
