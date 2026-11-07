<script setup lang="ts">
import BrandMark from './BrandMark.vue'

// The top bar on signed-out pages (landing, sign in): the logo on the left, the page's own
// links in the slot on the right. It stays at the top while the page scrolls.
</script>

<template>
  <header class="sticky top-0 z-30 h-header border-b border-line bg-mist/90 backdrop-blur">
    <nav
      aria-label="Main"
      class="mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
    >
      <RouterLink
        :to="{ name: 'landing' }"
        class="flex min-h-11 items-center gap-2.5 font-display text-xl font-bold text-evergreen"
      >
        <BrandMark class="size-8" />
        DigiBridge
      </RouterLink>
      <div class="flex items-center gap-1">
        <slot />
      </div>
    </nav>
  </header>
</template>
