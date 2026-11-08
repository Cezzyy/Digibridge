<script setup lang="ts">
import {
  AREA_CODES,
  AREA_LABELS,
  ATTEMPT_DURATION_MINUTES,
  CHOICES_PER_QUESTION,
  CONSENT_CONTACT,
  ITEMS_PER_AREA,
  ITEMS_PER_ATTEMPT,
  LEVEL_LABELS,
  ROLE_LABELS,
} from '@digibridge/shared'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import InfoRow from '../components/home/InfoRow.vue'
import { ROW_ICONS, RULE_ICONS } from '../components/home/home-icons'
import { AREA_DETAILS } from '../components/landing/areas'
import { STEPS } from '../components/landing/steps'
import StartLayout from '../components/start/StartLayout.vue'
import StartSteps from '../components/start/StartSteps.vue'
import { useStartAttempt } from '../composables/useStartAttempt'
import { PRIMARY_BUTTON } from '../lib/buttons'
import { LEVEL_BANDS, LEVEL_TONE, levelRange } from '../lib/levels'
import { useSessionStore } from '../stores/session'

// Where signed-in users land. Respondents without a profile never see it: the `step` guard sends
// them to the privacy notice. Respondents see their next step: the assessment's rules and Start,
// then, once started or finished, the way back to it or to their results. Staff (later /admin)
// get a preview of the student steps, which saves nothing.
//
// Start begins the attempt (the 25-minute timer starts on the server) and opens the assessment;
// Continue goes back to the one in progress.
const session = useSessionStore()
const router = useRouter()
const { start, starting, error: startError } = useStartAttempt()

async function begin() {
  // A 409 (no profile, already taken, not ready) reloads /me, so the page follows it.
  if (await start()) await router.push({ name: 'assessment' })
}

type View = 'start' | 'in-progress' | 'finished' | 'staff'
const view = computed<View>(() => {
  const me = session.me
  if (!me?.respondent) return 'staff'
  // /me leaves out a voided attempt, so a respondent whose attempt was voided can start again.
  switch (me.attempt?.status) {
    case undefined:
      return 'start'
    case 'in_progress':
      return 'in-progress'
    default:
      return 'finished'
  }
})

const name = computed(
  () =>
    session.me?.respondent?.fullName ?? session.me?.profile.fullName ?? session.me?.profile.email,
)

const HEADINGS: Record<View, { title: string; lead: string }> = {
  start: {
    title: 'You’re all set',
    lead: `Your profile is saved. Next, answer ${ITEMS_PER_ATTEMPT} questions to find your level in each skill area.`,
  },
  'in-progress': {
    title: 'Welcome back',
    lead: 'You’ve started the assessment. Your answers are saved, and the timer is still running.',
  },
  finished: {
    title: 'Well done',
    lead: 'You’ve finished the assessment. Your level and lessons will show up here.',
  },
  staff: {
    title: 'Hi',
    lead: 'Go through the student steps to see what students see. It’s only a preview, so nothing you enter is saved.',
  },
}
const heading = computed(() => HEADINGS[view.value])

const facts = [
  { value: ITEMS_PER_ATTEMPT, label: 'questions' },
  { value: ATTEMPT_DURATION_MINUTES, label: 'minutes' },
  { value: AREA_CODES.length, label: 'skill areas' },
]

const RULES = [
  {
    icon: RULE_ICONS.choices,
    title: 'One question at a time',
    body: `Each question has ${CHOICES_PER_QUESTION} choices. Pick the one you think is best.`,
  },
  {
    icon: RULE_ICONS.saved,
    title: 'Your answers save as you go',
    body: 'Each answer saves as soon as you pick it. If the page reloads, you carry on where you were.',
  },
  {
    icon: RULE_ICONS.back,
    title: 'Go back anytime',
    body: 'Change an answer or jump to a question you skipped, until you submit.',
  },
  {
    icon: RULE_ICONS.timer,
    title: 'The timer keeps running',
    body: `You have ${ATTEMPT_DURATION_MINUTES} minutes. Closing the page doesn’t pause it, and at 0 your answers are sent.`,
  },
]

const areas = AREA_CODES.map((code, i) => ({
  code,
  number: String(i + 1).padStart(2, '0'),
  label: AREA_LABELS[code],
  summary: AREA_DETAILS[code].summary,
}))

// The level scale, lowest first, each part as wide as its range.
const levels = LEVEL_BANDS.map((band) => ({
  ...band,
  label: LEVEL_LABELS[band.level],
  range: levelRange(band),
  tone: LEVEL_TONE[band.level],
}))
const TICKS = [0, ...LEVEL_BANDS.map((band) => band.to)]
const levelsText = computed(() =>
  view.value === 'staff'
    ? `In each area, students get one of ${levels.length} levels from the points they earn, and lessons that fit their level. Their results show up as soon as they submit.`
    : `In each area, you get one of ${levels.length} levels from the points you earn, and lessons that fit your level. Your results show up as soon as you submit.`,
)

// The steps a student goes through, for the staff preview (sign-in is behind them already).
const studentSteps = STEPS.slice(1)
</script>

<template>
  <StartLayout v-if="session.me && session.role" stick-on-phones fit-screen>
    <template #rail>
      <!-- Phones show the step bar above the heading; desktops list the steps under it. -->
      <StartSteps
        v-if="view !== 'staff'"
        :current="view === 'finished' ? 'results' : 'questions'"
        class="mb-6 lg:order-1 lg:mt-10 lg:mb-0"
      />
      <p
        v-else
        class="mb-6 inline-flex self-start rounded-full bg-white/10 px-3 py-1 text-sm font-semibold ring-1 ring-white/20 ring-inset"
      >
        {{ ROLE_LABELS[session.role] }}
      </p>

      <h1
        class="text-[clamp(2rem,1.5rem+1.6vw,3.25rem)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance motion-safe:animate-rise"
      >
        {{ heading.title }}<template v-if="name">, {{ name }}</template>
      </h1>
      <p
        class="mt-3 text-lg leading-relaxed text-white/85 lg:mt-4 motion-safe:animate-rise motion-safe:[animation-delay:80ms]"
      >
        {{ heading.lead }}
      </p>
      <dl
        v-if="view === 'start' || view === 'staff'"
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

      <div
        class="mt-auto hidden space-y-3 pt-10 text-sm leading-relaxed text-white/85 lg:order-2 lg:block lg:short:hidden"
      >
        <p v-if="view !== 'staff'" class="flex gap-3">
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
        <p class="flex gap-3">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            class="mt-px size-5 shrink-0 fill-none stroke-marigold stroke-2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
          <span class="min-w-0 break-words">Signed in as {{ session.me.profile.email }}</span>
        </p>
      </div>
    </template>

    <!-- Started or finished: one message in the middle of the page. -->
    <section
      v-if="view === 'in-progress' || view === 'finished'"
      class="mx-auto flex max-w-2xl flex-col justify-center py-6 motion-safe:animate-rise lg:min-h-[calc(100svh-var(--spacing-header)-6rem)]"
      aria-labelledby="status-title"
    >
      <span
        class="grid size-14 place-items-center rounded-full"
        :class="view === 'finished' ? 'bg-evergreen-soft' : 'bg-marigold-soft'"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          class="size-7 fill-none stroke-2"
          :class="view === 'finished' ? 'stroke-evergreen' : 'stroke-marigold-text'"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            v-for="d in view === 'finished' ? ROW_ICONS.levels : RULE_ICONS.timer"
            :key="d"
            :d="d"
          />
        </svg>
      </span>
      <template v-if="view === 'in-progress'">
        <h2
          id="status-title"
          class="mt-6 text-3xl leading-tight font-bold tracking-[-0.02em] text-balance sm:text-4xl"
        >
          Pick up where you left off
        </h2>
        <p class="mt-4 text-lg leading-relaxed text-quiet">
          Your answers so far are saved. The timer kept running while you were away, so go back to
          the questions soon.
        </p>
      </template>
      <template v-else>
        <h2
          id="status-title"
          class="mt-6 text-3xl leading-tight font-bold tracking-[-0.02em] text-balance sm:text-4xl"
        >
          Your results are on the way
        </h2>
        <p class="mt-4 text-lg leading-relaxed text-quiet">
          You’ll see your level in each skill area here, with lessons that fit it. Check back soon.
        </p>
      </template>
    </section>

    <article
      v-else
      aria-labelledby="home-title"
      class="motion-safe:animate-rise motion-safe:[animation-delay:120ms]"
    >
      <!-- Big screens without room for it (`snug:`) keep it for screen readers only, so the page fits. -->
      <header class="flex items-center gap-4 2xl:snug:sr-only">
        <span class="grid size-12 shrink-0 place-items-center rounded-card bg-evergreen-soft">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            class="size-7 fill-none stroke-evergreen stroke-2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              v-for="d in view === 'staff' ? ROW_ICONS.steps : ROW_ICONS.rules"
              :key="d"
              :d="d"
            />
          </svg>
        </span>
        <div>
          <h2 id="home-title" class="text-2xl leading-tight font-bold sm:text-3xl">
            {{ view === 'staff' ? 'What students see' : 'Before you start' }}
          </h2>
          <p class="text-quiet">
            {{
              view === 'staff'
                ? 'The steps, what the assessment checks and what students get'
                : 'How the assessment works, what it checks and what you get'
            }}
          </p>
        </div>
      </header>

      <ol
        class="mt-6 divide-y 2xl:snug:mt-0 divide-line overflow-hidden rounded-card border border-line bg-surface"
      >
        <InfoRow v-if="view === 'staff'" title="The student steps" :icon="ROW_ICONS.steps">
          <ol class="space-y-4 2xl:grid 2xl:grid-cols-2 2xl:gap-x-8 2xl:gap-y-5 2xl:space-y-0">
            <li v-for="(step, i) in studentSteps" :key="step.screen" class="flex gap-3">
              <span
                aria-hidden="true"
                class="grid size-7 shrink-0 place-items-center rounded-full bg-evergreen-soft font-display text-sm font-bold text-evergreen"
              >
                {{ i + 1 }}
              </span>
              <div class="min-w-0 pt-0.5">
                <p class="font-semibold">{{ step.title }}</p>
                <p class="mt-0.5 leading-relaxed text-quiet">{{ step.body }}</p>
              </div>
            </li>
          </ol>
        </InfoRow>

        <InfoRow v-else title="How it works" :icon="ROW_ICONS.rules">
          <ul
            class="grid gap-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"
          >
            <li
              v-for="rule in RULES"
              :key="rule.title"
              class="flex gap-3 rounded-control bg-mist-soft px-4 py-3.5 2xl:py-3"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                class="mt-0.5 size-5 shrink-0 fill-none stroke-evergreen stroke-[1.75]"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path v-for="d in rule.icon" :key="d" :d="d" />
              </svg>
              <div class="min-w-0">
                <p class="font-semibold text-evergreen">{{ rule.title }}</p>
                <p class="mt-1 leading-relaxed">{{ rule.body }}</p>
              </div>
            </li>
          </ul>
        </InfoRow>

        <InfoRow title="What it checks" :icon="ROW_ICONS.areas">
          <ul class="grid gap-3 2xl:grid-cols-3">
            <li
              v-for="area in areas"
              :key="area.code"
              class="flex gap-3 rounded-control bg-mist-soft px-4 py-3.5 2xl:flex-col 2xl:gap-2 2xl:py-3"
            >
              <!-- Wide screens put the question count beside the number, so the cards stay short. -->
              <p class="flex shrink-0 items-baseline justify-between gap-3">
                <span
                  class="w-7 font-display text-lg leading-6 font-bold text-marigold-text tabular-nums"
                >
                  {{ area.number }}
                </span>
                <span class="hidden text-sm text-quiet 2xl:inline">
                  {{ ITEMS_PER_AREA }} questions
                </span>
              </p>
              <div class="min-w-0">
                <p class="font-semibold text-evergreen">{{ area.label }}</p>
                <p class="mt-1 leading-relaxed">{{ area.summary }}</p>
                <p class="mt-2 text-sm text-quiet 2xl:hidden">{{ ITEMS_PER_AREA }} questions</p>
              </div>
            </li>
          </ul>
        </InfoRow>

        <InfoRow
          :title="view === 'staff' ? 'What students get' : 'What you get'"
          :icon="ROW_ICONS.levels"
        >
          <p class="max-w-[68ch] leading-relaxed">{{ levelsText }}</p>
          <div class="mt-5" aria-hidden="true">
            <div class="flex h-3 gap-0.5 overflow-hidden rounded-full">
              <span
                v-for="level in levels"
                :key="level.level"
                :class="level.tone"
                :style="{ flexGrow: level.to - level.from }"
              />
            </div>
            <div class="relative mt-1.5 h-4 text-xs text-quiet 2xl:hidden">
              <span
                v-for="tick in TICKS"
                :key="tick"
                class="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
                :style="{ left: `${tick}%` }"
              >
                {{ tick }}%
              </span>
            </div>
          </div>
          <!-- Wide screens name each level under its part of the bar instead of in a key. -->
          <ul class="mt-4 grid gap-2 sm:grid-cols-2 2xl:mt-2 2xl:flex 2xl:gap-0.5">
            <li
              v-for="level in levels"
              :key="level.level"
              class="flex items-center gap-3 2xl:min-w-0 2xl:basis-0 2xl:flex-col 2xl:items-start 2xl:gap-0"
              :style="{ flexGrow: level.to - level.from }"
            >
              <span
                aria-hidden="true"
                class="size-4 shrink-0 rounded-sm 2xl:hidden"
                :class="level.tone"
              />
              <span class="2xl:contents">
                <span class="font-semibold">{{ level.label }}</span>
                <span class="text-quiet"><span class="2xl:hidden"> · </span>{{ level.range }}</span>
              </span>
            </li>
          </ul>
        </InfoRow>
      </ol>
    </article>

    <template v-if="view !== 'finished'" #actions>
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8">
        <p class="flex items-center gap-3 leading-snug">
          <span
            aria-hidden="true"
            class="grid size-8 shrink-0 place-items-center rounded-full bg-marigold-soft"
          >
            <span class="size-2.5 rounded-full bg-marigold" />
          </span>
          <span v-if="view === 'staff'">
            You go through the same pages as students, but nothing you enter is saved.
          </span>
          <span v-else-if="view === 'start'">
            You can take it <strong>once</strong>. The {{ ATTEMPT_DURATION_MINUTES }}-minute timer
            starts when you choose <strong>Start</strong>.
          </span>
          <span v-else>The timer is still running.</span>
        </p>

        <RouterLink
          v-if="view === 'staff'"
          :to="{ name: 'consent' }"
          :class="[PRIMARY_BUTTON, 'shrink-0']"
        >
          Try the student steps
        </RouterLink>
        <div v-else class="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <p
            v-if="startError"
            role="alert"
            class="text-sm font-semibold text-error sm:order-first sm:max-w-xs"
          >
            {{ startError }}
          </p>
          <button
            v-if="view === 'start'"
            type="button"
            :class="PRIMARY_BUTTON"
            :disabled="starting"
            @click="begin"
          >
            {{ starting ? 'Starting…' : 'Start' }}
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              class="size-4 fill-none stroke-current stroke-[2.5]"
            >
              <path d="M6 3.5 10.5 8 6 12.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <RouterLink v-else :to="{ name: 'assessment' }" :class="PRIMARY_BUTTON">
            Continue
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              class="size-4 fill-none stroke-current stroke-[2.5]"
            >
              <path d="M6 3.5 10.5 8 6 12.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </RouterLink>
        </div>
      </div>
    </template>
  </StartLayout>
</template>
