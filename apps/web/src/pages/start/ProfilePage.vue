<script setup lang="ts">
import {
  DEVICE_LABELS,
  DEVICES,
  FULL_NAME_MAX_LENGTH,
  INTERNET_ACCESS,
  INTERNET_ACCESS_LABELS,
  onlineRespondentSchema,
  SEX_LABELS,
  SEXES,
  type Device,
  type InternetAccess,
  type Sex,
} from '@digibridge/shared'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import BirthDateField from '../../components/start/BirthDateField.vue'
import {
  DEVICE_ICONS,
  IDENTITY_ICONS,
  INTERNET_ACCESS_ICONS,
} from '../../components/start/choice-icons'
import TextField from '../../components/form/TextField.vue'
import FormSection from '../../components/start/FormSection.vue'
import OptionGroup, { type Option } from '../../components/start/OptionGroup.vue'
import StartSteps from '../../components/start/StartSteps.vue'
import { useCreateRespondent } from '../../composables/useCreateRespondent'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../lib/buttons'
import { useConsentStore } from '../../stores/consent'
import { useSessionStore } from '../../stores/session'

// The online profile (PRO-01) and the show-identity choice (PRO-05). No school details: online
// never asks for them (PRO-06). Saving sends the consent from the previous page with it, which
// the `step` guard makes sure exists.
const session = useSessionStore()
const consent = useConsentStore()
const router = useRouter()
const { save, saving, error: saveError } = useCreateRespondent()

const googleName = session.me?.profile.fullName ?? ''
const form = reactive({
  fullName: googleName,
  birthDate: null as string | null,
  sex: null as Sex | null,
  devices: [] as Device[],
  internetAccess: [] as InternetAccess[],
  showIdentity: null as boolean | null,
})

const sexOptions: Option<Sex>[] = SEXES.map((value) => ({ value, label: SEX_LABELS[value] }))
const deviceOptions: Option<Device>[] = DEVICES.map((value) => ({
  value,
  label: DEVICE_LABELS[value],
  icon: DEVICE_ICONS[value],
}))
const internetOptions: Option<InternetAccess>[] = INTERNET_ACCESS.map((value) => ({
  value,
  label: INTERNET_ACCESS_LABELS[value],
  icon: INTERNET_ACCESS_ICONS[value],
}))
const identityOptions: Option<boolean>[] = [
  {
    value: true,
    label: 'Yes, show my name',
    hint: 'The DigiBridge team sees your name with your answers.',
    icon: IDENTITY_ICONS.show,
  },
  {
    value: false,
    label: 'No, hide my name',
    hint: 'The team still sees your answers, but your name shows as Hidden.',
    icon: IDENTITY_ICONS.hide,
  },
]

const result = computed(() =>
  onlineRespondentSchema.safeParse({
    fullName: form.fullName,
    birthDate: form.birthDate ?? undefined,
    sex: form.sex ?? undefined,
    devices: form.devices,
    internetAccess: form.internetAccess,
    showIdentity: form.showIdentity ?? undefined,
    consentVersion: session.me ? consent.versionFor(session.me.profile.id) : null,
  }),
)

// Each answer's error shows once the student has left or answered that question, or tried to
// save, and then follows the answer as it changes.
const tried = ref(false)
type Field = keyof typeof form
const touched = reactive(new Set<Field>())
const touch = (field: Field) => touched.add(field)
for (const field of ['sex', 'devices', 'internetAccess', 'showIdentity'] as const) {
  watch(
    () => form[field],
    () => touch(field),
  )
}

// Leaving the name box tidies it the way the API saves it: no extra spaces.
function leaveName() {
  form.fullName = form.fullName.trim().replace(/\s+/g, ' ')
  touch('fullName')
}

/** The first message for each field (or the form), whether shown yet or not. */
const issues = computed(() => {
  const byField: Partial<Record<Field | 'form', string>> = {}
  if (result.value.success) return byField
  for (const issue of result.value.error.issues) {
    const field = issue.path[0]
    const key = typeof field === 'string' && field in form ? (field as Field) : 'form'
    byField[key] ??= issue.message
  }
  return byField
})
const errors = computed(() => {
  const shown: Partial<Record<Field | 'form', string>> = {}
  for (const [key, message] of Object.entries(issues.value) as [Field | 'form', string][]) {
    if (tried.value || (key !== 'form' && touched.has(key))) shown[key] = message
  }
  return shown
})
const fieldErrorCount = computed(() => Object.keys(errors.value).filter((k) => k !== 'form').length)

async function submit() {
  tried.value = true
  if (!result.value.success) {
    await nextTick()
    // Move to the first question that needs an answer.
    const first = document.querySelector<HTMLElement>(
      '[data-invalid] input, input[aria-invalid="true"]',
    )
    first?.focus()
    return
  }
  if (await save(result.value.data)) await router.replace({ name: 'home' })
}
</script>

<template>
  <main class="mx-auto max-w-2xl px-4 pt-6 pb-16 sm:pt-10">
    <StartSteps current="profile" />

    <h1
      class="mt-8 text-3xl leading-tight font-bold tracking-[-0.02em] text-balance sm:text-4xl motion-safe:animate-rise"
    >
      Tell us a bit about you
    </h1>
    <p
      class="mt-3 text-lg leading-relaxed text-quiet motion-safe:animate-rise motion-safe:[animation-delay:80ms]"
    >
      This helps us see who needs more help with digital skills. There are no right or wrong answers
      here.
    </p>

    <form
      novalidate
      class="mt-8 space-y-5 motion-safe:animate-rise motion-safe:[animation-delay:160ms]"
      @submit.prevent="submit"
    >
      <FormSection :number="1" title="About you">
        <TextField
          v-model="form.fullName"
          label="Full name"
          :hint="
            googleName
              ? 'We filled this in from Google. Change it if it isn’t your real name.'
              : 'Your first and last name.'
          "
          autocomplete="name"
          :maxlength="FULL_NAME_MAX_LENGTH"
          :error="errors.fullName"
          :valid="touched.has('fullName') && !issues.fullName"
          @touch="leaveName"
        >
          <template #icon>
            <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
            <path d="M4 20a8 8 0 0 1 16 0" />
          </template>
        </TextField>

        <BirthDateField
          v-model="form.birthDate"
          :error="errors.birthDate"
          @touch="touch('birthDate')"
        />

        <OptionGroup
          v-model="form.sex"
          legend="Sex"
          :options="sexOptions"
          :columns="3"
          :error="errors.sex"
        />
      </FormSection>

      <FormSection
        :number="2"
        title="Your devices and internet"
        description="So we can see how people get online."
      >
        <OptionGroup
          v-model="form.devices"
          legend="Which devices do you own?"
          hint="Pick all that apply."
          :options="deviceOptions"
          multiple
          exclusive="none"
          :columns="2"
          :error="errors.devices"
        />

        <OptionGroup
          v-model="form.internetAccess"
          legend="How do you usually get internet?"
          hint="Pick all that apply."
          :options="internetOptions"
          multiple
          exclusive="none"
          :columns="2"
          :error="errors.internetAccess"
        />
      </FormSection>

      <FormSection
        :number="3"
        title="Your privacy"
        description="Either way, your answers count the same."
      >
        <OptionGroup
          v-model="form.showIdentity"
          legend="May the DigiBridge team see your name?"
          :options="identityOptions"
          :columns="2"
          :error="errors.showIdentity"
        />
      </FormSection>

      <p
        v-if="saveError || errors.form"
        role="alert"
        class="rounded-control bg-error-soft px-4 py-3 text-error"
      >
        {{ saveError ?? errors.form }}
      </p>
      <p
        v-else-if="tried && fieldErrorCount > 0"
        role="alert"
        class="rounded-control bg-error-soft px-4 py-3 text-error"
      >
        {{
          fieldErrorCount === 1
            ? 'One answer needs fixing. It’s marked in red.'
            : `${fieldErrorCount} answers need fixing. They’re marked in red.`
        }}
      </p>

      <div class="flex flex-col-reverse gap-3 pt-3 sm:flex-row sm:justify-between">
        <RouterLink :to="{ name: 'consent' }" :class="SECONDARY_BUTTON">
          Back to the notice
        </RouterLink>
        <button type="submit" :class="PRIMARY_BUTTON" :disabled="saving">
          <svg
            v-if="saving"
            viewBox="0 0 24 24"
            aria-hidden="true"
            class="size-5 fill-none stroke-current stroke-[3] motion-safe:animate-spin"
          >
            <path d="M12 3a9 9 0 1 0 9 9" stroke-linecap="round" />
          </svg>
          {{ saving ? 'Saving…' : 'Save and continue' }}
        </button>
      </div>
    </form>
  </main>
</template>
