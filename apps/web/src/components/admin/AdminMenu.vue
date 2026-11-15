<script setup lang="ts">
import { computed } from 'vue'
import { useAdminNav } from '../../composables/useAdminNav'
import SideMenu from '../SideMenu.vue'
import { ICONS } from './admin-icons'

// The admin area's menu below `lg`, where AdminLayout has no side menu: the admin pages, then
// the students' lesson library, in the shared SideMenu. It loads with the admin area, so students never download it.
const items = useAdminNav()
const sections = computed(() => [
  items.value,
  [{ label: 'Lesson library', to: { name: 'lessons' }, icon: ICONS.lessons }],
])
</script>

<template>
  <SideMenu title="Admin" nav-label="Admin" :sections="sections" close-from="(min-width: 64rem)" />
</template>
