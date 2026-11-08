<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../lib/buttons'

// Asks before submitting, with how many questions have no answer (ASM-08). A native modal
// dialog, so focus stays inside it and Esc closes it (unless the answers are being sent).
const props = defineProps<{
  open: boolean
  total: number
  answered: number
  unsaved: number
  submitting: boolean
  error: string | null
}>()
const emit = defineEmits<{ confirm: []; close: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const id = useId()
const unanswered = computed(() => props.total - props.answered)

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
  if (props.submitting) event.preventDefault()
}
</script>

<template>
  <dialog
    ref="dialog"
    :aria-labelledby="`${id}-title`"
    :aria-describedby="`${id}-body`"
    class="m-auto w-[calc(100%-2rem)] max-w-md rounded-card bg-surface p-6 text-ink shadow-[0_30px_60px_-20px_rgb(18_36_28/0.45)] backdrop:bg-ink/55 sm:p-7"
    @cancel="onCancel"
    @close="emit('close')"
  >
    <h2 :id="`${id}-title`" class="text-2xl leading-tight font-bold">Submit your answers?</h2>
    <div :id="`${id}-body`" class="mt-4 space-y-3 leading-relaxed">
      <p
        v-if="unanswered > 0"
        class="rounded-control bg-marigold-soft px-4 py-3 shadow-[inset_3px_0_0_var(--color-marigold)]"
      >
        You answered <strong>{{ answered }} of {{ total }}</strong
        >. {{ unanswered === 1 ? '1 question has' : `${unanswered} questions have` }} no answer and
        {{ unanswered === 1 ? 'counts' : 'count' }} as wrong.
      </p>
      <p v-else>You answered all {{ total }} questions.</p>
      <p v-if="unsaved > 0" class="text-quiet">
        {{ unsaved === 1 ? '1 answer is' : `${unsaved} answers are` }} still saving. We’ll send
        {{ unsaved === 1 ? 'it' : 'them' }} first.
      </p>
      <p>Once you submit, you can’t change your answers.</p>
      <p v-if="error" role="alert" class="font-semibold text-error">{{ error }}</p>
    </div>
    <div class="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
      <button type="button" :class="PRIMARY_BUTTON" :disabled="submitting" @click="emit('confirm')">
        {{ submitting ? 'Sending…' : error ? 'Try again' : 'Submit' }}
      </button>
      <button
        type="button"
        :class="SECONDARY_BUTTON"
        :disabled="submitting"
        autofocus
        @click="emit('close')"
      >
        Keep answering
      </button>
    </div>
  </dialog>
</template>
