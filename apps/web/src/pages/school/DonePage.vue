<script setup lang="ts">
import SiteHeader from '../../components/SiteHeader.vue'
import { PRIMARY_BUTTON } from '../../lib/buttons'

// The last page through a school link (LNK-06), after Done cleared the student from this
// browser. It needs neither the link nor a token, so it shows even once the link has closed.
// The lessons stay open to everyone (LES-03).
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <SiteHeader />
    <main class="grid flex-1 place-items-center px-4 py-12">
      <div class="flex max-w-md flex-col items-center text-center motion-safe:animate-rise">
        <span
          class="grid size-14 place-items-center rounded-full bg-evergreen-soft"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            class="size-7 fill-none stroke-evergreen stroke-[2.5]"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <h1 class="mt-5 text-3xl leading-tight font-bold tracking-[-0.02em] text-balance">
          You’re all done
        </h1>
        <p class="mt-3 text-lg leading-relaxed text-pretty text-quiet">
          Thanks for taking part. We’ve cleared your details from this device, so it’s ready for the
          next person.
        </p>
        <p class="mt-3 leading-relaxed text-pretty text-quiet">
          The lessons are open to everyone, so you can keep learning anytime.
        </p>
        <div class="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
          <RouterLink :to="{ name: 'lessons' }" :class="PRIMARY_BUTTON"
            >Browse the lessons</RouterLink
          >
        </div>
      </div>
    </main>
  </div>
</template>
