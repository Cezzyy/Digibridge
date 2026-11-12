<script setup lang="ts">
import { useId } from 'vue'

// An answer that's already decided, shown where its field would be: a school link set for one
// course or year level fills it in, and the student can't change it. Laid out like TextField.
defineProps<{ label: string; value: string; hint?: string }>()
const id = useId()
</script>

<template>
  <div>
    <p :id="`${id}-label`" class="text-lg font-semibold">{{ label }}</p>
    <p v-if="hint" :id="`${id}-hint`" class="mt-0.5 text-quiet">{{ hint }}</p>
    <p
      :aria-labelledby="`${id}-label`"
      :aria-describedby="hint ? `${id}-hint` : undefined"
      class="mt-2 flex min-h-12 items-center gap-3 rounded-control border border-line bg-mist-soft px-4 text-lg"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        class="size-5 shrink-0 fill-none stroke-quiet stroke-[1.75]"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      {{ value }}
    </p>
  </div>
</template>
