<script setup lang="ts">
import {
  CONSENT_CONTACT,
  ONLINE_CONSENT_NOTICE,
  SCHOOL_CONSENT_NOTICE,
  slugFromTitle,
} from '@digibridge/shared'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import SectionEyebrow from '../components/landing/SectionEyebrow.vue'
import LessonToc from '../components/lessons/LessonToc.vue'
import SiteFooter from '../components/SiteFooter.vue'
import SiteHeader from '../components/SiteHeader.vue'
import NoticeSections from '../components/start/NoticeSections.vue'
import { useReadingPosition } from '../composables/useReadingPosition'
import { useSessionStore } from '../stores/session'

// The privacy notices for anyone to read before they start, without signing in: the one for
// Google sign-in and the one for school links, the same text the consent page shows (CON-01).
// `?notice=school` picks the school one, so a link can open it directly. Google's OAuth consent
// screen links here too. Reading it agrees to nothing: that happens on the consent page. From `lg`
// the notice switch sits beside it, and below that the contents (with the section on screen
// marked) stay in view while the notice scrolls. Only the contents stick, so the column always
// fits a laptop screen without scrolling inside it.
const route = useRoute()
const session = useSessionStore()

const NOTICES = [
  {
    key: 'online',
    label: 'Signing in with Google',
    short: 'With a Google account',
    intro: 'For anyone who signs in with a Google account on this site.',
    notice: ONLINE_CONSENT_NOTICE,
  },
  {
    key: 'school',
    label: 'Through a school link',
    short: 'From your school, no sign-in',
    intro: 'For students who open a link their school sent them. There’s no Google sign-in.',
    notice: SCHOOL_CONSENT_NOTICE,
  },
] as const

const current = computed(() => NOTICES.find((n) => n.key === route.query.notice) ?? NOTICES[0])

// The contents: one entry per section, with the same ids NoticeSections gives them.
const contents = computed(() =>
  current.value.notice.sections.map((section, i) => ({
    id: slugFromTitle(section.title),
    title: section.title,
    number: i + 1,
  })),
)
const body = ref<HTMLElement | null>(null)
const { activeId, refresh } = useReadingPosition(
  body,
  computed(() => contents.value.map((c) => c.id)),
)
watch(current, refresh, { flush: 'post' })
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
          <p class="mt-5 text-lg leading-relaxed text-justify hyphens-auto">
            There are two ways to take DigiBridge, and each has its own notice. You read yours and
            choose whether to agree before you start. Reading it here doesn’t sign you up for
            anything.
          </p>
        </header>

        <div
          class="mt-10 gap-10 lg:mt-14 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)] xl:gap-14"
        >
          <!-- Beside the notice from `lg`: which notice, then its contents, which stick. -->
          <aside class="motion-safe:animate-rise motion-safe:[animation-delay:80ms]">
            <!-- Links, so each notice has its own address and Back works. -->
            <nav aria-labelledby="which-title">
              <p id="which-title" class="text-sm font-semibold text-quiet">Which notice</p>
              <ul class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <li v-for="option in NOTICES" :key="option.key">
                  <RouterLink
                    :to="{ query: option.key === 'online' ? {} : { notice: option.key } }"
                    replace
                    :aria-current="option.key === current.key ? 'page' : undefined"
                    class="flex h-full gap-3 rounded-card border px-4 py-3.5 transition-colors"
                    :class="
                      option.key === current.key
                        ? 'border-evergreen bg-evergreen-soft'
                        : 'border-line bg-surface hover:border-line-strong'
                    "
                  >
                    <span
                      aria-hidden="true"
                      class="mt-1 grid size-4 shrink-0 place-items-center rounded-full border-2"
                      :class="
                        option.key === current.key ? 'border-evergreen' : 'border-line-strong'
                      "
                    >
                      <span
                        v-if="option.key === current.key"
                        class="size-1.5 rounded-full bg-evergreen"
                      />
                    </span>
                    <span>
                      <span class="block leading-snug font-semibold">{{ option.label }}</span>
                      <span class="mt-0.5 block text-sm leading-snug text-quiet">
                        {{ option.short }}
                      </span>
                    </span>
                  </RouterLink>
                </li>
              </ul>
            </nav>

            <LessonToc
              :sections="contents"
              :active-id="activeId"
              title="In this notice"
              class="top-[calc(var(--spacing-header)+2rem)] mt-8 hidden lg:sticky lg:block"
            />
          </aside>

          <div ref="body" class="mt-8 lg:mt-0">
            <article
              :key="current.key"
              aria-labelledby="notice-title"
              class="motion-safe:animate-rise motion-safe:[animation-delay:120ms]"
            >
              <header class="flex items-start gap-4">
                <span
                  class="grid size-12 shrink-0 place-items-center rounded-card bg-evergreen text-on-evergreen"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    class="size-7 fill-none stroke-current stroke-2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </span>
                <div class="min-w-0">
                  <h2 id="notice-title" class="text-2xl leading-tight font-bold sm:text-3xl">
                    {{ current.label }}
                  </h2>
                  <p class="mt-1 text-quiet text-justify hyphens-auto">{{ current.intro }}</p>
                  <p
                    class="mt-3 inline-flex items-center rounded-full border border-line px-3 py-0.5 text-sm text-quiet"
                  >
                    Notice version {{ current.notice.version }}
                  </p>
                </div>
              </header>

              <NoticeSections :notice="current.notice" stacked class="mt-8" />
            </article>

            <section
              aria-labelledby="questions-title"
              class="mt-8 flex gap-4 rounded-card border border-line bg-evergreen-soft px-5 py-6 sm:px-8"
            >
              <span
                aria-hidden="true"
                class="grid size-11 shrink-0 place-items-center rounded-control bg-surface text-evergreen"
              >
                <svg
                  viewBox="0 0 24 24"
                  class="size-6 fill-none stroke-current stroke-[1.75]"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M4 6h16v12H4z" />
                  <path d="M4 7l8 6 8-6" />
                </svg>
              </span>
              <div>
                <h2 id="questions-title" class="text-lg font-bold">Questions about your data?</h2>
                <p class="mt-1 leading-relaxed text-justify hyphens-auto">
                  Contact {{ CONSENT_CONTACT }} to ask about your data, or to use any of the rights
                  above.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>

    <SiteFooter />
  </div>
</template>
