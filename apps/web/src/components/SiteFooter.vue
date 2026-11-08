<script setup lang="ts">
import BrandMark from './BrandMark.vue'

// The footer on signed-out pages (landing, sign in).
</script>

<template>
  <footer class="bg-ink text-sm text-white/65">
    <div
      class="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:gap-10 sm:px-6 lg:px-8"
    >
      <p class="flex items-center gap-2 font-display text-base font-bold text-white">
        <BrandMark class="size-6" />
        DigiBridge
      </p>
      <p class="max-w-2xl leading-relaxed sm:text-right">
        Check your digital skills and find lessons that fit your level. Built on DigComp 2.2. © 2026
        DigiBridge.
      </p>
    </div>
  </footer>
</template>
