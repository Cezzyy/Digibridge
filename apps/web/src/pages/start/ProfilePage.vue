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
import { computed, nextTick, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
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
  // Text, not a number input: phones then show the number pad without the spinner's quirks.
  age: '',
  sex: null as Sex | null,
  devices: [] as Device[],
  internetAccess: [] as InternetAccess[],
  showIdentity: null as boolean | null,
})

const sexOptions: Option<Sex>[] = SEXES.map((value) => ({ value, label: SEX_LABELS[value] }))
const deviceOptions: Option<Device>[] = DEVICES.map((value) => ({
  value,
  label: DEVICE_LABELS[value],
}))
const internetOptions: Option<InternetAccess>[] = INTERNET_ACCESS.map((value) => ({
  value,
  label: INTERNET_ACCESS_LABELS[value],
}))
const identityOptions: Option<boolean>[] = [
  {
    value: true,
    label: 'Yes, show my name',
    hint: 'The DigiBridge team sees your name with your answers.',
  },
  {
    value: false,
    label: 'No, hide my name',
    hint: 'The team still sees your answers, but your name shows as Hidden.',
  },
]

// Whole numbers only; anything else fails the shared schema with its own message.
function parseAge(text: string) {
  const trimmed = text.trim()
  if (trimmed === '') return undefined
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN
}

const result = computed(() =>
  onlineRespondentSchema.safeParse({
    fullName: form.fullName,
    age: parseAge(form.age),
    sex: form.sex ?? undefined,
    devices: form.devices,
    internetAccess: form.internetAccess,
    showIdentity: form.showIdentity ?? undefined,
    consentVersion: session.me ? consent.versionFor(session.me.profile.id) : null,
  }),
)

// Shown after the first try to save, then kept up to date as the answers change.
const tried = ref(false)
type Field = keyof typeof form
const errors = computed(() => {
  const byField: Partial<Record<Field | 'form', string>> = {}
  if (!tried.value || result.value.success) return byField
  for (const issue of result.value.error.issues) {
    const field = issue.path[0]
    const key = typeof field === 'string' && field in form ? (field as Field) : 'form'
    byField[key] ??= issue.message
  }
  return byField
})

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

const INPUT =
  'mt-2 block min-h-12 w-full rounded-control border bg-surface px-4 text-lg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-evergreen'
const inputClass = (field: Field) => [
  INPUT,
  errors.value[field] ? 'border-error' : 'border-line-strong',
]
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
      class="mt-8 space-y-8 rounded-card border border-line bg-surface p-5 sm:p-7 motion-safe:animate-rise motion-safe:[animation-delay:160ms]"
      @submit.prevent="submit"
    >
      <div>
        <label for="full-name" class="text-lg font-semibold">Full name</label>
        <p v-if="googleName" id="full-name-hint" class="mt-0.5 text-quiet">
          We filled this in from Google. Change it if it isn’t your real name.
        </p>
        <input
          id="full-name"
          v-model="form.fullName"
          type="text"
          autocomplete="name"
          :maxlength="FULL_NAME_MAX_LENGTH"
          :aria-invalid="errors.fullName ? 'true' : undefined"
          :aria-describedby="
            [googleName && 'full-name-hint', errors.fullName && 'full-name-error']
              .filter(Boolean)
              .join(' ') || undefined
          "
          :class="inputClass('fullName')"
        />
        <p v-if="errors.fullName" id="full-name-error" class="mt-2 font-semibold text-error">
          {{ errors.fullName }}
        </p>
      </div>

      <div>
        <label for="age" class="text-lg font-semibold">Age</label>
        <input
          id="age"
          v-model="form.age"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          maxlength="2"
          :aria-invalid="errors.age ? 'true' : undefined"
          :aria-describedby="errors.age ? 'age-error' : undefined"
          :class="[inputClass('age'), 'max-w-32']"
        />
        <p v-if="errors.age" id="age-error" class="mt-2 font-semibold text-error">
          {{ errors.age }}
        </p>
      </div>

      <OptionGroup
        v-model="form.sex"
        legend="Sex"
        :options="sexOptions"
        :columns="3"
        :error="errors.sex"
      />

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

      <div class="border-t border-line pt-8">
        <OptionGroup
          v-model="form.showIdentity"
          legend="May the DigiBridge team see your name?"
          hint="Either way, your answers count the same."
          :options="identityOptions"
          :columns="2"
          :error="errors.showIdentity"
        />
      </div>

      <p
        v-if="saveError || errors.form"
        role="alert"
        class="rounded-control bg-error-soft px-4 py-3 text-error"
      >
        {{ saveError ?? errors.form }}
      </p>
      <p
        v-else-if="tried && !result.success"
        role="alert"
        class="rounded-control bg-error-soft px-4 py-3 text-error"
      >
        Please check the answers marked in red.
      </p>

      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
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
