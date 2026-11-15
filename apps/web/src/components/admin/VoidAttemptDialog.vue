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

// Asks an admin why they're voiding an attempt (USR-03): one of VOID_REASONS, and a note, which
// `other` needs. Checked with voidAttemptSchema on Void; `confirm` sends the checked input.
const props = defineProps<{
  open: boolean
  /** The attempt is still in progress, so voiding stops it at once. */
  inProgress: boolean
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

const message = computed(() =>
  props.inProgress
    ? 'They’re still taking it: voiding stops it now, and their answers stop saving. It’s left out of every result and stat, and they can start again.'
    : 'It’s left out of every result and stat, and they can start again. Their answers and scores stay here for the record.',
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
    @confirm="confirm"
    @close="emit('close')"
  >
    <fieldset :aria-describedby="errors.reason ? `${id}-reason-error` : undefined">
      <legend class="text-lg font-semibold">Why?</legend>
      <div class="mt-2 grid gap-1">
        <label
          v-for="value in VOID_REASONS"
          :key="value"
          class="flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-2 hover:bg-evergreen-soft"
        >
          <input
            v-model="reason"
            type="radio"
            :name="`${id}-reason`"
            :value="value"
            :disabled="busy"
            class="size-5 shrink-0 accent-evergreen"
          />
          <span>{{ VOID_REASON_LABELS[value] }}</span>
        </label>
      </div>
      <p v-if="errors.reason" :id="`${id}-reason-error`" class="mt-2 font-semibold text-error">
        {{ errors.reason }}
      </p>
    </fieldset>

    <div class="mt-4">
      <label :for="`${id}-note`" class="text-lg font-semibold">Note</label>
      <p :id="`${id}-note-hint`" class="mt-0.5 text-quiet">
        {{ reason === 'other' ? 'Say what happened.' : 'Optional. What happened, for the team.' }}
      </p>
      <textarea
        :id="`${id}-note`"
        v-model="note"
        rows="3"
        :maxlength="VOID_NOTE_MAX_LENGTH"
        :disabled="busy"
        :aria-invalid="errors.note ? 'true' : undefined"
        :aria-describedby="`${id}-note-hint` + (errors.note ? ` ${id}-note-error` : '')"
        class="mt-2 block w-full rounded-control border bg-surface px-4 py-3 text-lg transition-colors hover:border-evergreen focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-evergreen"
        :class="errors.note ? 'border-error' : 'border-line-strong'"
      />
      <p v-if="errors.note" :id="`${id}-note-error`" class="mt-2 font-semibold text-error">
        {{ errors.note }}
      </p>
    </div>
  </ConfirmDialog>
</template>
