<script setup lang="ts">
// Whether new assessments can pick a question: Active, or Inactive (CMS-02).
defineProps<{ active: boolean }>()
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold"
    :class="active ? 'bg-evergreen-soft text-evergreen' : 'bg-mist-soft text-quiet'"
  >
    <span
      aria-hidden="true"
      class="size-2 rounded-full"
      :class="active ? 'bg-evergreen' : 'border border-line-strong'"
    />
    {{ active ? 'Active' : 'Inactive' }}
  </span>
</template>
