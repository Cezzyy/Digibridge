<script setup lang="ts">
import { computed } from 'vue'
import type { NavItem } from '../lib/nav'
import { useSessionStore } from '../stores/session'
import { ICONS } from './admin/admin-icons'
import SideMenu from './SideMenu.vue'

// The menu on every other page with AppHeader below `sm`, where the header's links don't fit:
// the user's own page (home, or results once their attempt is finished, since home sends them
// there), Lessons, and Admin for staff, in the shared SideMenu. Signed out, home is the landing page.
const session = useSessionStore()

const sections = computed<NavItem[][]>(() => {
  const start: NavItem = !session.isSignedIn
    ? { label: 'Home', to: { name: 'landing' }, icon: ICONS.home }
    : session.attemptFinished && !session.isStaff
      ? { label: 'My results', to: { name: 'results' }, icon: ICONS.started }
      : { label: 'Home', to: { name: 'home' }, icon: ICONS.home }
  const pages: NavItem[] = [
    start,
    { label: 'Lessons', to: { name: 'lessons' }, icon: ICONS.lessons },
  ]
  return session.isStaff
    ? [pages, [{ label: 'Admin', to: { name: 'admin' }, icon: ICONS.overview }]]
    : [pages]
})
</script>

<template>
  <SideMenu title="Menu" nav-label="Main" :sections="sections" close-from="(min-width: 40rem)" />
</template>
