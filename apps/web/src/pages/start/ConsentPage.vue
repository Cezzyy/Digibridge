<script setup lang="ts">
import {
  AREA_CODES,
  ATTEMPT_DURATION_MINUTES,
  CONSENT_CONTACT,
  ITEMS_PER_ATTEMPT,
} from '@digibridge/shared'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import LinkTag from '../../components/start/LinkTag.vue'
import NoticeSections from '../../components/start/NoticeSections.vue'
import StartLayout from '../../components/start/StartLayout.vue'
import StartSteps from '../../components/start/StartSteps.vue'
import { useRespondentFlow } from '../../composables/useRespondentFlow'
import { askSignOut } from '../../composables/useSignOut'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../lib/buttons'
import { useConsentStore } from '../../stores/consent'
import { useSessionStore } from '../../stores/session'

// The privacy notice (CON-01), the first thing a new respondent sees: online after signing in,
// and through a school link (/s/:code) as soon as the link opens, with the school notice.
// Agreeing is kept in memory and saved with the profile on the next page (CON-02), so declining
// saves nothing. The `step` guard sends respondents who already have a profile home.
const session = useSessionStore()
const consent = useConsentStore()
const flow = useRespondentFlow()
const router = useRouter()
const notice = flow.notice.value

// Online, the Google name; a school-link student hasn't told us theirs yet.
const name = flow.isSchool.value ? null : session.me?.profile.fullName
const declined = ref(false)
const declinedHeading = useTemplateRef('declined-heading')

const facts = [
  { value: ITEMS_PER_ATTEMPT, label: 'questions' },
  { value: ATTEMPT_DURATION_MINUTES, label: 'minutes' },
  { value: AREA_CODES.length, label: 'skill areas' },
]

async function agree() {
  const key = flow.consentKey.value
  if (!key) return
  consent.agree(key, notice.version)
  await router.push(flow.page('profile'))
}

// Online, declining leaves the student signed in, so Sign out is offered; a link has no sign-in.
const canSignOut = computed(() => !flow.isSchool.value)

async function decline() {
  consent.clear()
  declined.value = true
  await nextTick()
  window.scrollTo({ top: 0 })
  declinedHeading.value?.focus()
}
</script>

<template>
  <StartLayout>
    <template #rail>
      <!-- Phones show the step bar above the heading; desktops list the steps under it. -->
      <StartSteps current="consent" class="mb-6 lg:order-1 lg:mt-10 lg:mb-0" />
      <LinkTag />

      <h1
        class="text-[clamp(2rem,1.5rem+1.6vw,3.25rem)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance motion-safe:animate-rise"
      >
        Before you start<template v-if="name">, {{ name }}</template>
      </h1>
      <p
        class="mt-3 text-lg leading-relaxed text-white/85 text-justify hyphens-auto lg:mt-4 motion-safe:animate-rise motion-safe:[animation-delay:80ms]"
      >
        DigiBridge checks your digital skills, then shows you your level and lessons that fit it.
        First, here’s what we do with your answers.
      </p>
      <dl
        class="mt-6 grid grid-cols-3 gap-2 sm:max-w-md lg:max-w-none motion-safe:animate-rise motion-safe:[animation-delay:160ms]"
      >
        <div
          v-for="fact in facts"
          :key="fact.label"
          class="flex flex-col-reverse rounded-card bg-white/10 px-3 py-3 ring-1 ring-white/15 ring-inset sm:px-4"
        >
          <dt class="text-sm text-white/80">{{ fact.label }}</dt>
          <dd class="font-display text-3xl leading-none font-bold">{{ fact.value }}</dd>
        </div>
      </dl>

      <p
        class="mt-auto hidden gap-3 pt-10 text-sm leading-relaxed text-white/85 text-justify hyphens-auto lg:order-2 lg:flex lg:short:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          class="mt-px size-5 shrink-0 fill-none stroke-marigold stroke-2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        Questions about your data? Contact {{ CONSENT_CONTACT }}. Only the team can see your
        answers.
      </p>
    </template>

    <!-- Declined: nothing was saved, and they can still change their mind. -->
    <section
      v-if="declined"
      class="mx-auto flex max-w-2xl flex-col justify-center py-6 motion-safe:animate-rise lg:min-h-[calc(100svh-var(--spacing-header)-6rem)]"
      aria-labelledby="declined-title"
    >
      <span class="grid size-14 place-items-center rounded-full bg-marigold-soft">
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          class="size-7 fill-none stroke-marigold-text stroke-2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" />
          <path d="M8.5 14.5s1.2 1.5 3.5 1.5 3.5-1.5 3.5-1.5" />
          <path d="M9 9.5h.01M15 9.5h.01" />
        </svg>
      </span>
      <h2
        id="declined-title"
        ref="declined-heading"
        tabindex="-1"
        class="mt-6 text-3xl leading-tight font-bold tracking-[-0.02em] text-balance outline-none sm:text-4xl"
      >
        No problem. You won’t take the assessment.
      </h2>
      <p class="mt-4 text-lg leading-relaxed text-quiet text-justify hyphens-auto">
        We haven’t saved a profile or any answers for you. If you change your mind, come back and
        read the notice again.
      </p>
      <div class="mt-8 flex flex-col gap-3 sm:flex-row">
        <button type="button" :class="PRIMARY_BUTTON" @click="declined = false">
          Read the notice again
        </button>
        <button v-if="canSignOut" type="button" :class="SECONDARY_BUTTON" @click="askSignOut">
          Sign out
        </button>
      </div>
    </section>

    <article
      v-else
      aria-labelledby="notice-title"
      class="motion-safe:animate-rise motion-safe:[animation-delay:120ms]"
    >
      <header class="flex items-center gap-4">
        <span class="grid size-12 shrink-0 place-items-center rounded-card bg-evergreen-soft">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            class="size-7 fill-none stroke-evergreen stroke-2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </span>
        <div>
          <h2 id="notice-title" class="text-2xl leading-tight font-bold sm:text-3xl">
            {{ notice.title }}
          </h2>
          <p class="text-quiet">Under the Data Privacy Act of 2012 (Republic Act 10173)</p>
        </div>
      </header>

      <NoticeSections :notice="notice" class="mt-6" />
    </article>

    <template v-if="!declined" #actions>
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8">
        <p class="flex items-center gap-3 leading-snug">
          <span
            aria-hidden="true"
            class="grid size-8 shrink-0 place-items-center rounded-full bg-marigold-soft"
          >
            <span class="size-2.5 rounded-full bg-marigold" />
          </span>
          <span>
            By choosing <strong>I agree</strong>, you let us use your answers as this notice says.
          </span>
        </p>
        <!-- On phones the buttons stack, with I agree on top. -->
        <div class="flex shrink-0 flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" :class="SECONDARY_BUTTON" @click="decline">Decline</button>
          <button type="button" :class="PRIMARY_BUTTON" @click="agree">
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              class="size-4 fill-none stroke-current stroke-[2.5]"
            >
              <path d="M3.5 8.5l3 3 6-7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            I agree
          </button>
        </div>
      </div>
    </template>
  </StartLayout>
</template>
