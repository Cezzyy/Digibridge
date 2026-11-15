<script setup lang="ts">
import type { Mode } from '@digibridge/shared'
import { computed, ref, watch } from 'vue'
import ConfirmDialog from '../ConfirmDialog.vue'
import TextField from '../form/TextField.vue'

// Asks an admin to type DELETE before deleting a respondent's data for good (USR-03). The button
// stays on, so it's never a puzzle why it won't work: pressed without the word, it says what's
// missing.
const props = defineProps<{
  open: boolean
  /** Their name as the team sees it, or null when they chose to hide it. */
  name: string | null
  mode: Mode
  busy: boolean
  error: string | null
}>()
const emit = defineEmits<{ confirm: []; close: [] }>()

const WORD = 'DELETE'
const typed = ref('')
const tried = ref(false)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    typed.value = ''
    tried.value = false
  },
)

const matches = computed(() => typed.value.trim() === WORD)
const typedError = computed(() =>
  tried.value && !matches.value ? `Type ${WORD} in capitals to delete.` : null,
)

const title = computed(() =>
  props.name ? `Delete ${props.name}’s data?` : 'Delete this respondent’s data?',
)
const message = computed(
  () =>
    `This deletes their profile, consent, answers, results and survey for good. It can’t be undone. ${
      props.mode === 'online'
        ? 'Their Google account stays, so if they sign in again they start over from the notice.'
        : 'Their student number and their place on the link are freed.'
    }`,
)

function confirm() {
  tried.value = true
  if (matches.value) emit('confirm')
}
</script>

<template>
  <ConfirmDialog
    :open="open"
    :title="title"
    :message="message"
    confirm-label="Delete for good"
    busy-label="Deleting…"
    :busy="busy"
    :error="error"
    danger
    @confirm="confirm"
    @close="emit('close')"
  >
    <TextField
      v-model="typed"
      :label="`Type ${WORD} to confirm`"
      autocomplete="off"
      :error="typedError"
      :valid="matches"
    />
  </ConfirmDialog>
</template>
