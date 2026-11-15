<script setup lang="ts">
import {
  VOID_NOTE_MAX_LENGTH,
  VOID_REASON_LABELS,
  VOID_REASONS,
  voidAttemptSchema,
  type VoidAttempt,
  type VoidReason,
} from '@digibridge/shared'
import { computed, ref, useId, watch } from 'vue'
import ConfirmDialog from '../ConfirmDialog.vue'
import RadioGroup from '../form/RadioGroup.vue'

// Asks an admin why they're voiding an attempt (USR-03): one of VOID_REASONS, and a note, which
// `other` needs. Checked with voidAttemptSchema on Void; `confirm` sends the checked input.
const props = defineProps<{
  open: boolean
  /** The attempt is still in progress, so voiding stops it at once. */
  inProgress: boolean
  /** They came through a school link: the void ends their sign-in there, so they join again. */
  school: boolean
  busy: boolean
  error: string | null
}>()
const emit = defineEmits<{ confirm: [input: VoidAttempt]; close: [] }>()

const id = useId()
const reason = ref<VoidReason | null>(null)
const note = ref('')
const tried = ref(false)

// Each opening starts blank.
watch(
  () => props.open,
  (open) => {
    if (!open) return
    reason.value = null
    note.value = ''
    tried.value = false
  },
)

const checked = computed(() =>
  voidAttemptSchema.safeParse({ reason: reason.value, note: note.value }),
)
const errors = computed(() => {
  if (!tried.value || checked.value.success) return { reason: null, note: null }
  const issues = checked.value.error.issues
  return {
    reason: issues.some((i) => i.path[0] === 'reason') ? 'Pick a reason.' : null,
    note: issues.find((i) => i.path[0] === 'note')?.message ?? null,
  }
})

const reasons = VOID_REASONS.map((value) => ({ value, label: VOID_REASON_LABELS[value] }))

const message = computed(
  () =>
    (props.inProgress ? 'They’re still taking it, so this stops it now. ' : '') +
    'It’s left out of every result and stat, and they can start again' +
    (props.school
      ? ' by opening a school link that’s still open (this one, or a new one if it has ended) and filling in their details again. '
      : '. ') +
    'Answers and scores stay for the record.',
)

function confirm() {
  tried.value = true
  if (checked.value.success) emit('confirm', checked.value.data)
}
</script>

<template>
  <ConfirmDialog
    :open="open"
    title="Void this attempt?"
    :message="message"
    confirm-label="Void attempt"
    busy-label="Voiding…"
    :busy="busy"
    :error="error"
    danger
    wide
    @confirm="confirm"
    @close="emit('close')"
  >
    <RadioGroup
      v-model="reason"
      legend="Why?"
      :options="reasons"
      :error="errors.reason"
      :disabled="busy"
    />

    <div class="mt-4">
      <label :for="`${id}-note`" class="font-semibold">
        Note
        <span class="font-normal text-quiet">{{
          reason === 'other' ? '(say what happened)' : '(optional)'
        }}</span>
      </label>
      <textarea
        :id="`${id}-note`"
        v-model="note"
        rows="2"
        :maxlength="VOID_NOTE_MAX_LENGTH"
        :disabled="busy"
        :aria-invalid="errors.note ? 'true' : undefined"
        :aria-describedby="errors.note ? `${id}-note-error` : undefined"
        class="mt-1.5 block w-full resize-none rounded-control border bg-surface px-3 py-2 leading-snug transition-colors hover:border-evergreen focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-evergreen disabled:opacity-60"
        :class="errors.note ? 'border-error' : 'border-line-strong'"
      />
      <p
        v-if="errors.note"
        :id="`${id}-note-error`"
        class="mt-1.5 text-sm font-semibold text-error"
      >
        {{ errors.note }}
      </p>
    </div>
  </ConfirmDialog>
</template>
