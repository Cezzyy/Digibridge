<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { returningFromGoogle } from '../lib/supabase'
import BrandMark from './BrandMark.vue'

// A short branded intro the first time the site opens in a tab. It sits over the page and
// fades away, so the page (or AppSplash, if it's still loading) is ready underneath.
// Not shown on the way back from Google: AppSplash says "Signing you in" there instead.
const SEEN_KEY = 'digibridge:intro-seen'
const SHOW_FOR_MS = 1600

function firstVisitInTab() {
  try {
    if (sessionStorage.getItem(SEEN_KEY) !== null) return false
    sessionStorage.setItem(SEEN_KEY, '1')
    return true
  } catch {
    // Storage blocked: skip the intro rather than show it on every page load.
    return false
  }
}

const visible = ref(!returningFromGoogle && firstVisitInTab())

onMounted(() => {
  if (visible.value) setTimeout(() => (visible.value = false), SHOW_FOR_MS)
})
</script>

<template>
  <Transition leave-active-class="transition-opacity duration-500" leave-to-class="opacity-0">
    <!-- Decorative, so screen readers skip it. A click or tap skips it too. -->
    <div
      v-if="visible"
      class="fixed inset-0 z-50 grid place-items-center bg-mist px-4"
      aria-hidden="true"
      @click="visible = false"
    >
      <div class="flex flex-col items-center text-center">
        <BrandMark class="size-20 motion-safe:animate-rise" />
        <p
          class="mt-6 font-display text-4xl font-bold text-evergreen motion-safe:animate-rise motion-safe:[animation-delay:150ms]"
        >
          DigiBridge
        </p>
        <p
          class="mt-2 text-lg text-quiet motion-safe:animate-rise motion-safe:[animation-delay:300ms]"
        >
          Check your digital skills
        </p>
      </div>
    </div>
  </Transition>
</template>
