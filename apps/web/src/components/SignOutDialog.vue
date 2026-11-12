<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useRespondentFlow } from '../composables/useRespondentFlow'
import { useSignOut } from '../composables/useSignOut'
import ConfirmDialog from './ConfirmDialog.vue'

// The "Sign out?" check behind every Sign out button (`askSignOut`). Mounted once, in App.vue.
// On a school-link page it's "Not you?" instead: someone else on the same phone or laptop.
const { asking, signingOut, cancel, confirm } = useSignOut()
const flow = useRespondentFlow()
const route = useRoute()

const student = computed(() => flow.respondent.value?.fullName ?? 'this student')

const title = computed(() => (flow.isSchool.value ? `Not ${student.value}?` : 'Sign out?'))

// Mid-assessment the timer keeps running on the server, so say so. Through a link there's no
// way back once the student is cleared from the browser.
const message = computed(() => {
  if (flow.isSchool.value) {
    return route.name === 'school-assessment'
      ? `This clears ${student.value} from this device so you can start as yourself. ${student.value}’s assessment can’t be opened here again, and its timer keeps running.`
      : `This clears ${student.value} from this device so you can start as yourself. ${student.value}’s results can’t be opened here again.`
  }
  return route.name === 'assessment'
    ? 'Your answers so far are saved, but the timer keeps running while you’re signed out. Sign in again with the same Google account to continue.'
    : 'You’ll need to sign in again with Google to come back.'
})
</script>

<template>
  <ConfirmDialog
    :open="asking"
    :title="title"
    :message="message"
    :confirm-label="flow.isSchool.value ? 'Start over' : 'Sign out'"
    :busy-label="flow.isSchool.value ? 'Clearing…' : 'Signing out…'"
    :busy="signingOut"
    :error="null"
    @confirm="confirm"
    @close="cancel"
  />
</template>
