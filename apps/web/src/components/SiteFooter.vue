<script setup lang="ts">
import BrandMark from './BrandMark.vue'

// The footer on signed-out pages (landing, privacy).
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
      <div class="max-w-2xl sm:text-right">
        <p class="leading-relaxed">
          Check your digital skills and find lessons that fit your level. Built on DigComp 2.2. ©
          2026 DigiBridge.
        </p>
        <!-- Both open without signing in: the library (LES-03) and the privacy notices. -->
        <div class="mt-2 flex flex-wrap gap-x-6 sm:justify-end">
          <RouterLink
            :to="{ name: 'lessons' }"
            class="inline-flex min-h-11 items-center font-semibold text-white underline decoration-white/40 underline-offset-2 hover:decoration-white"
          >
            Browse the lessons
          </RouterLink>
          <RouterLink
            :to="{ name: 'privacy' }"
            class="inline-flex min-h-11 items-center font-semibold text-white underline decoration-white/40 underline-offset-2 hover:decoration-white"
          >
            Privacy notice
          </RouterLink>
        </div>
      </div>
    </div>
  </footer>
</template>
