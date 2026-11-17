<script setup lang="ts">
import { CONSENT_CONTACT, ONLINE_CONSENT_NOTICE, SCHOOL_CONSENT_NOTICE } from '@digibridge/shared'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import SectionEyebrow from '../components/landing/SectionEyebrow.vue'
import SiteFooter from '../components/SiteFooter.vue'
import SiteHeader from '../components/SiteHeader.vue'
import NoticeSections from '../components/start/NoticeSections.vue'
import { useSessionStore } from '../stores/session'

// The privacy notices for anyone to read before they start, without signing in: the one for
// Google sign-in and the one for school links, the same text the consent page shows (CON-01).
// `?notice=school` picks the school one, so a link can open it directly. Google's OAuth consent
// screen links here too. Reading it agrees to nothing: that happens on the consent page.
const route = useRoute()
const session = useSessionStore()

const NOTICES = [
  {
    key: 'online',
    label: 'Signing in with Google',
    intro: 'For anyone who signs in with a Google account on this site.',
    notice: ONLINE_CONSENT_NOTICE,
  },
  {
    key: 'school',
    label: 'Through a school link',
    intro: 'For students who open a link their school sent them. There’s no Google sign-in.',
    notice: SCHOOL_CONSENT_NOTICE,
  },
] as const

const current = computed(() => NOTICES.find((n) => n.key === route.query.notice) ?? NOTICES[0])
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <SiteHeader>
      <RouterLink
        :to="{ name: 'lessons' }"
        class="hidden min-h-11 items-center rounded-control px-3 font-semibold text-quiet transition-colors hover:text-ink sm:inline-flex"
      >
        Lessons
      </RouterLink>
      <RouterLink
        v-if="session.isSignedIn"
        :to="session.startPage"
        class="ml-2 inline-flex min-h-11 items-center rounded-control border border-line-strong px-4 font-semibold text-evergreen transition-colors hover:bg-evergreen-soft"
      >
        {{ session.isStaff ? 'Admin' : 'Home' }}
      </RouterLink>
      <RouterLink
        v-else
        :to="{ name: 'sign-in' }"
        class="ml-2 inline-flex min-h-11 items-center rounded-control border border-line-strong px-4 font-semibold text-evergreen transition-colors hover:bg-evergreen-soft"
      >
        Sign in
      </RouterLink>
    </SiteHeader>

    <main class="flex-1">
      <div class="mx-auto w-full max-w-6xl px-4 pt-10 pb-16 sm:px-6 sm:pt-14 sm:pb-24 lg:px-8">
        <header class="max-w-3xl motion-safe:animate-rise">
          <SectionEyebrow class="text-evergreen">Your privacy</SectionEyebrow>
          <h1
            class="mt-3 text-[clamp(2.25rem,1.6rem+2.4vw,3.75rem)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance"
          >
            Privacy notice
          </h1>
          <p class="mt-2 text-quiet">Under the Data Privacy Act of 2012 (Republic Act 10173)</p>
          <p class="mt-5 text-lg leading-relaxed text-pretty">
            There are two ways to take DigiBridge, and each has its own notice. You read yours and
            choose whether to agree before you start. Reading it here doesn’t sign you up for
            anything.
          </p>
        </header>

        <!-- Which notice: links, so each one has its own address and Back works. -->
        <nav
          aria-label="Which notice"
          class="mt-10 grid gap-2 rounded-card border border-line bg-surface p-1.5 sm:inline-grid sm:grid-cols-2 motion-safe:animate-rise motion-safe:[animation-delay:80ms]"
        >
          <RouterLink
            v-for="option in NOTICES"
            :key="option.key"
            :to="{ query: option.key === 'online' ? {} : { notice: option.key } }"
            replace
            :aria-current="option.key === current.key ? 'page' : undefined"
            class="inline-flex min-h-11 items-center justify-center rounded-control px-5 font-semibold transition-colors"
            :class="
              option.key === current.key
                ? 'bg-evergreen text-on-evergreen'
                : 'text-quiet hover:bg-evergreen-soft hover:text-ink'
            "
          >
            {{ option.label }}
          </RouterLink>
        </nav>

        <article
          :key="current.key"
          aria-labelledby="notice-title"
          class="mt-8 motion-safe:animate-rise motion-safe:[animation-delay:120ms]"
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
                {{ current.label }}
              </h2>
              <p class="text-quiet">{{ current.intro }}</p>
            </div>
          </header>

          <NoticeSections :notice="current.notice" wide class="mt-6" />

          <p class="mt-3 text-sm text-quiet">Notice version {{ current.notice.version }}</p>
        </article>

        <section
          aria-labelledby="questions-title"
          class="mt-10 flex gap-4 rounded-card bg-evergreen-soft px-5 py-6 sm:px-7"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            class="mt-0.5 size-6 shrink-0 fill-none stroke-evergreen stroke-2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          <div>
            <h2 id="questions-title" class="text-lg font-bold">Questions about your data?</h2>
            <p class="mt-1 max-w-[68ch] leading-relaxed">
              Contact {{ CONSENT_CONTACT }} to ask about your data, or to use any of the rights
              above.
            </p>
          </div>
        </section>
      </div>
    </main>

    <SiteFooter />
  </div>
</template>
