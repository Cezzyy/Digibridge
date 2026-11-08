<script setup lang="ts">
import {
  ATTEMPT_DURATION_MINUTES,
  ITEMS_PER_ATTEMPT,
  ONLINE_CONSENT_NOTICE,
} from '@digibridge/shared'
import { nextTick, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import StartSteps from '../../components/start/StartSteps.vue'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../lib/buttons'
import { useConsentStore } from '../../stores/consent'
import { useSessionStore } from '../../stores/session'

// The privacy notice (CON-01), the first thing a new respondent sees after signing in.
// Agreeing is kept in memory and saved with the profile on the next page (CON-02), so declining
// saves nothing. The `step` guard sends respondents who already have a profile home.
const session = useSessionStore()
const consent = useConsentStore()
const router = useRouter()
const notice = ONLINE_CONSENT_NOTICE

const name = session.me?.profile.fullName
const declined = ref(false)
const declinedHeading = useTemplateRef('declined-heading')

async function agree() {
  if (!session.me) return
  consent.agree(session.me.profile.id, notice.version)
  await router.push({ name: 'profile' })
}

async function decline() {
  consent.clear()
  declined.value = true
  await nextTick()
  window.scrollTo({ top: 0 })
  declinedHeading.value?.focus()
}

async function signOut() {
  await session.signOut()
  await router.push({ name: 'landing' })
}
</script>

<template>
  <main class="mx-auto max-w-2xl px-4 pt-6 pb-16 sm:pt-10">
    <!-- Declined: nothing was saved, and they can still change their mind. -->
    <section v-if="declined" class="motion-safe:animate-rise" aria-labelledby="declined-title">
      <h1
        id="declined-title"
        ref="declined-heading"
        tabindex="-1"
        class="mt-6 text-3xl leading-tight font-bold tracking-[-0.02em] text-balance outline-none sm:text-4xl"
      >
        No problem. You won’t take the assessment.
      </h1>
      <p class="mt-4 text-lg leading-relaxed text-quiet">
        We haven’t saved a profile or any answers for you. If you change your mind, come back and
        read the notice again.
      </p>
      <div class="mt-8 flex flex-col gap-3 sm:flex-row">
        <button type="button" :class="PRIMARY_BUTTON" @click="declined = false">
          Read the notice again
        </button>
        <button type="button" :class="SECONDARY_BUTTON" @click="signOut">Sign out</button>
      </div>
    </section>

    <template v-else>
      <StartSteps current="consent" />

      <h1
        class="mt-8 text-3xl leading-tight font-bold tracking-[-0.02em] text-balance sm:text-4xl motion-safe:animate-rise"
      >
        Before you start<template v-if="name">, {{ name }}</template>
      </h1>
      <p
        class="mt-3 text-lg leading-relaxed text-quiet motion-safe:animate-rise motion-safe:[animation-delay:80ms]"
      >
        DigiBridge checks your digital skills with {{ ITEMS_PER_ATTEMPT }} questions in
        {{ ATTEMPT_DURATION_MINUTES }} minutes, then shows you your level and lessons that fit it.
        First, here’s what we do with your answers.
      </p>

      <article
        aria-labelledby="notice-title"
        class="mt-8 overflow-hidden rounded-card border border-line bg-surface motion-safe:animate-rise motion-safe:[animation-delay:160ms]"
      >
        <header class="flex items-start gap-4 border-b border-line bg-mist-soft px-5 py-4 sm:px-6">
          <span class="grid size-11 shrink-0 place-items-center rounded-full bg-evergreen-soft">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              class="size-6 fill-none stroke-evergreen stroke-2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </span>
          <div>
            <h2 id="notice-title" class="text-xl font-bold">{{ notice.title }}</h2>
            <p class="text-sm text-quiet">
              Under the Data Privacy Act of 2012 (Republic Act 10173)
            </p>
          </div>
        </header>

        <div class="divide-y divide-line px-5 sm:px-6">
          <section v-for="section in notice.sections" :key="section.title" class="py-5">
            <h3 class="text-lg font-bold">{{ section.title }}</h3>
            <p
              v-for="paragraph in section.body"
              :key="paragraph"
              class="mt-2 leading-relaxed text-pretty"
            >
              {{ paragraph }}
            </p>
          </section>
        </div>
      </article>

      <p class="mt-6 rounded-control bg-marigold-soft px-4 py-3 leading-relaxed">
        By choosing <strong>I agree</strong>, you agree to take part in the study and let us use
        your answers as this notice says.
      </p>

      <!-- On phones the buttons stack, with I agree on top. -->
      <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
    </template>
  </main>
</template>
