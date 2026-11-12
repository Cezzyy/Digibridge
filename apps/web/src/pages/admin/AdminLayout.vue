<script setup lang="ts">
import StrokeIcon from '../../components/admin/StrokeIcon.vue'
import { useAdminNav } from '../../composables/useAdminNav'

// The frame of every /admin page, under AppHeader: a menu on the left from `lg`, which stays put
// while the page scrolls. Below `lg` the same pages are in the menu that opens from the header's
// menu button (AdminMenu), so the page starts right under the header.
const items = useAdminNav()
</script>

<template>
  <div class="min-h-[calc(100dvh-var(--spacing-header))] lg:flex">
    <nav
      aria-label="Admin"
      class="hidden border-r border-line bg-surface lg:block lg:w-64 lg:shrink-0"
    >
      <div class="sticky top-header px-4 py-6">
        <p class="px-3 text-sm font-semibold tracking-wide text-quiet uppercase">Admin</p>
        <ul class="mt-3 flex flex-col gap-1">
          <li v-for="item in items" :key="item.label">
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
