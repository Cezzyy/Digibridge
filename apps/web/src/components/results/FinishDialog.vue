<script setup lang="ts">
import { nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../lib/buttons'
import SusForm from '../SusForm.vue'

// Done on a school-link student's results (LNK-06). If they haven't rated DigiBridge yet, the
// usability survey opens first (SUS-03); they can still skip it. Then it asks once more, since
// Done clears them from this browser and the results can't be opened here again. A native modal
// dialog, so focus stays inside it and Esc closes it.
const props = defineProps<{
  open: boolean
  /** The attempt to rate, or null once the survey is answered or skipped. */
  susAttemptId: string | null
}>()
const emit = defineEmits<{ close: []; finish: []; rated: [] }>()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const confirmTitle = useTemplateRef<HTMLHeadingElement>('confirm-title')
const id = useId()
const stage = ref<'sus' | 'confirm'>('confirm')
const rated = ref(false)

watch(
  () => props.open,
  (open) => {
    const el = dialog.value
    if (!el) return
    if (open && !el.open) {
      stage.value = props.susAttemptId ? 'sus' : 'confirm'
      rated.value = false
      el.showModal()
    }
    if (!open && el.open) el.close()
  },
  { flush: 'post' },
)

async function toConfirm() {
  stage.value = 'confirm'
  await nextTick()
  confirmTitle.value?.focus()
}

async function onRated() {
  rated.value = true
  emit('rated')
  await toConfirm()
}
</script>

<template>
  <dialog
    ref="dialog"
    :aria-labelledby="stage === 'confirm' ? `${id}-title` : undefined"
    :aria-label="stage === 'sus' ? 'Rate DigiBridge before you finish' : undefined"
    class="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-card bg-surface text-ink shadow-lg backdrop:bg-scrim"
    :class="stage === 'sus' ? 'max-w-4xl' : 'max-w-md p-6 sm:p-7'"
    @close="emit('close')"
  >
    <SusForm
      v-if="stage === 'sus' && susAttemptId"
      :attempt-id="susAttemptId"
      class="border-0"
      @saved="onRated"
      @skip="toConfirm"
    />

    <template v-else>
      <h2
        :id="`${id}-title`"
        ref="confirm-title"
        tabindex="-1"
        class="text-xl leading-tight font-bold outline-none"
      >
        {{ rated ? 'Thanks! Ready to finish?' : 'Ready to finish?' }}
      </h2>
      <div class="mt-3 space-y-2 leading-relaxed text-quiet">
        <p>
          Done clears your details from this device, so the next person who uses it can’t see them.
          You won’t be able to open these results here again.
        </p>
        <p>Your answers stay saved for the DigiBridge team.</p>
      </div>
      <div class="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
        <button type="button" :class="PRIMARY_BUTTON" @click="emit('finish')">Done</button>
        <button type="button" :class="SECONDARY_BUTTON" autofocus @click="emit('close')">
          Back to my results
        </button>
      </div>
    </template>
  </dialog>
</template>
