<script setup lang="ts">
import { SECONDARY_BUTTON } from '../../lib/buttons'

// A load that failed on an admin page: the message and a Try again button.
defineProps<{ message: string }>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div
    role="alert"
    class="flex flex-col gap-4 rounded-card bg-error-soft p-5 sm:flex-row sm:items-center sm:justify-between"
  >
    <p class="font-semibold text-error">{{ message }}</p>
    <button type="button" :class="SECONDARY_BUTTON" class="bg-surface" @click="emit('retry')">
      Try again
    </button>
  </div>
</template>
