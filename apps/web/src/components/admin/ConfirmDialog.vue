<script setup lang="ts">
import { ref, useId, watch } from 'vue'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../lib/buttons'

// Asks before an action that can't be undone, like closing a school link. A native modal
// dialog, so focus stays inside it and Esc closes it (unless the action is running).
const props = defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel: string
  /** Shown on the button while the action runs, like "Closing…". */
  busyLabel: string
  busy: boolean
  error: string | null
}>()
const emit = defineEmits<{ confirm: []; close: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const id = useId()

watch(
  () => props.open,
  (open) => {
    const el = dialog.value
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  },
  { flush: 'post' },
)

function onCancel(event: Event) {
  if (props.busy) event.preventDefault()
}
</script>

<template>
  <dialog
    ref="dialog"
    :aria-labelledby="`${id}-title`"
    :aria-describedby="`${id}-body`"
    class="m-auto w-[calc(100%-2rem)] max-w-md rounded-card bg-surface p-6 text-ink shadow-lg backdrop:bg-scrim sm:p-7"
    @cancel="onCancel"
    @close="emit('close')"
  >
    <h2 :id="`${id}-title`" class="text-xl leading-tight font-bold">{{ title }}</h2>
    <div :id="`${id}-body`" class="mt-3 space-y-2 leading-relaxed text-quiet">
      <p>{{ message }}</p>
      <p v-if="error" role="alert" class="font-semibold text-error">{{ error }}</p>
    </div>
    <div class="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
      <button type="button" :class="PRIMARY_BUTTON" :disabled="busy" @click="emit('confirm')">
        {{ busy ? busyLabel : error ? 'Try again' : confirmLabel }}
      </button>
      <button
        type="button"
        :class="SECONDARY_BUTTON"
        :disabled="busy"
        autofocus
        @click="emit('close')"
      >
        Cancel
      </button>
    </div>
  </dialog>
</template>
