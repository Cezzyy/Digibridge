<script setup lang="ts">
import { returningFromGoogle } from '../lib/supabase'
import BrandMark from './BrandMark.vue'

// Shown until the first page is ready. Coming back from Google (?code=...) takes longest:
// Supabase swaps the code for a session, then the API loads or creates the profile.
</script>

<template>
  <!-- Fades in after a short delay, so quick loads don't flash it. -->
  <main
    class="grid min-h-dvh animate-splash place-items-center bg-mist px-4"
    role="status"
    aria-live="polite"
  >
    <div class="flex flex-col items-center text-center">
      <BrandMark class="size-14" />
      <p class="mt-5 font-display text-2xl font-bold text-evergreen">
        {{ returningFromGoogle ? 'Signing you in' : 'Loading DigiBridge' }}
      </p>
      <p v-if="returningFromGoogle" class="mt-1 text-quiet">This only takes a moment.</p>
      <!-- A marigold deck sliding across a track, like the bridge in the logo. -->
      <div class="mt-6 h-1.5 w-40 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div class="h-full w-1/3 rounded-full bg-marigold motion-safe:animate-deck" />
      </div>
    </div>
  </main>
</template>
