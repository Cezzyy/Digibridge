<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import { useSessionStore } from '../stores/session'
import AccountControls from './AccountControls.vue'
import AppMenu from './AppMenu.vue'
import BrandMark from './BrandMark.vue'

// Top bar on every page, so users can sign in or out from anywhere (AUTH-03). It stays at the
// top while the page scrolls, and spans the whole width like the start pages under it. The logo
// goes to where the user starts: the admin overview for staff, home for respondents.
//
// On phones there's no room for the links beside the account, so below `sm` a menu button before
// the logo opens AppMenu (the user's page, Lessons, Admin for staff, and the account or Sign in)
// and the bar keeps only the logo. In the admin area (`meta.adminMenu`) the button shows below
// `lg` instead and opens AdminMenu, with the admin pages; it loads with the admin area, so
// students never download it.
const AdminMenu = defineAsyncComponent(() => import('./admin/AdminMenu.vue'))

const session = useSessionStore()
const route = useRoute()
const adminMenu = computed(() => !!route.meta.adminMenu && session.isStaff)
</script>

<template>
  <header class="sticky top-0 z-30 h-header border-b border-line bg-surface">
    <div class="flex h-full w-full items-center justify-between gap-4 px-4 sm:px-8 lg:px-10">
      <div class="flex min-w-0 items-center gap-2">
        <div v-if="adminMenu" class="lg:hidden">
          <AdminMenu />
        </div>
        <div v-else class="sm:hidden">
          <AppMenu />
        </div>
        <RouterLink
          :to="session.isSignedIn ? session.startPage : { name: 'landing' }"
          class="flex min-h-11 items-center gap-2.5 font-display text-xl font-bold text-evergreen"
        >
          <BrandMark class="size-8" />
          DigiBridge
        </RouterLink>
      </div>

      <div
        class="flex min-w-0 items-center gap-4"
        :class="adminMenu ? 'max-lg:hidden' : 'max-sm:hidden'"
      >
        <RouterLink
          v-if="session.isStaff"
          :to="{ name: 'admin' }"
          class="hidden min-h-11 shrink-0 items-center rounded-control px-3 font-semibold text-quiet hover:text-ink sm:flex"
        >
          Admin
        </RouterLink>
        <RouterLink
          :to="{ name: 'lessons' }"
          class="hidden min-h-11 shrink-0 items-center rounded-control px-3 font-semibold text-quiet hover:text-ink sm:flex"
        >
          Lessons
        </RouterLink>

        <AccountControls v-if="session.isSignedIn" />

        <RouterLink
          v-else-if="!session.loading"
          :to="{ name: 'sign-in' }"
          class="flex min-h-11 shrink-0 items-center rounded-control border border-line-strong px-4 font-semibold text-evergreen hover:bg-evergreen-soft"
        >
          Sign in
        </RouterLink>
      </div>
    </div>
  </header>
</template>
