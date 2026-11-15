<script setup lang="ts">
// Whether students can open a lesson: Published, or Draft (only the team sees it).
defineProps<{ published: boolean }>()
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold"
    :class="published ? 'bg-evergreen-soft text-evergreen' : 'bg-mist-soft text-quiet'"
  >
    <span
      aria-hidden="true"
      class="size-2 rounded-full"
      :class="published ? 'bg-evergreen' : 'border border-line-strong'"
    />
    {{ published ? 'Published' : 'Draft' }}
  </span>
</template>
