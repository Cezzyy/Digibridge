<script setup lang="ts">
import { ITEMS_PER_ATTEMPT } from '@digibridge/shared'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AccountControls from '../../components/AccountControls.vue'
import BrandMark from '../../components/BrandMark.vue'
import CountdownTimer from '../../components/assessment/CountdownTimer.vue'
import QuestionCard from '../../components/assessment/QuestionCard.vue'
import QuestionGrid from '../../components/assessment/QuestionGrid.vue'
import SubmitDialog from '../../components/assessment/SubmitDialog.vue'
import ErrorScreen from '../../components/ErrorScreen.vue'
import { useCountdown } from '../../composables/useCountdown'
import { ApiRequestError } from '../../lib/api'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../lib/buttons'
import { useAttemptStore } from '../../stores/attempt'
import { useSessionStore } from '../../stores/session'

// The assessment (/assessment): one question at a time with Back and Next, the question grid to
// jump around, the timer from the server's clock, and Submit (ASM-01 to ASM-09). The `step`
// guard lets in only a respondent with an attempt in progress. Each answer saves as it's picked;
// a reload gets the same items, answers and time back. At 0 the answers are sent by themselves,
// and once the attempt is closed the page goes back to home.
const session = useSessionStore()
const store = useAttemptStore()
const router = useRouter()

const loadError = ref<string | null>(null)
const attemptId = computed(() => session.me?.attempt?.id ?? null)
const ready = computed(() => store.attempt !== null && store.attempt.id === attemptId.value)

const goHome = () => router.replace({ name: 'home' })

/** Goes home after fetching /me again, when the attempt here is no longer the student's one. */
async function leave() {
  await session.loadMe()
  await goHome()
}

async function load() {
  loadError.value = null
  const id = attemptId.value
  if (!id) return goHome()
  try {
    const data = await store.load(id)
    // Voided: /me leaves it out, so ask /me again rather than storing it (home would read it
    // as finished). The student can start again.
    if (data.status === 'voided') return leave()
    if (data.status !== 'in_progress') {
      session.setAttempt({ id: data.id, status: data.status })
      await goHome()
    }
  } catch (err) {
    if (err instanceof ApiRequestError && (err.code === 'not_found' || err.code === 'forbidden')) {
      // The account changed: let /me and home sort it out.
      return leave()
    }
    loadError.value =
      err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.'
  }
}
onMounted(load)

const { remainingMs } = useCountdown(() => (ready.value ? store.deadline : null))

const total = computed(() => store.items.length)
const item = computed(() => store.items[store.current] ?? null)
const isLast = computed(() => store.current >= total.value - 1)
const progress = computed(() => (total.value ? (store.answeredCount / total.value) * 100 : 0))

const card = ref<InstanceType<typeof QuestionCard> | null>(null)
const gridSection = ref<HTMLElement | null>(null)

/** Shows another question, moving focus to it so screen readers read it from the top. */
async function show(index: number) {
  if (index < 0 || index >= total.value) return
  store.current = index
  await nextTick()
  card.value?.focus()
  // On phones the card's top can be scrolled away; bring it back under the top bar.
  const top = (card.value?.$el as HTMLElement | undefined)?.getBoundingClientRect().top ?? 0
  if (top < 0) window.scrollBy({ top: top - 96 })
}

function showGrid() {
  gridSection.value?.scrollIntoView({ block: 'start' })
  gridSection.value?.focus({ preventScroll: true })
}

// ---- Submitting ----

const dialogOpen = ref(false)
const timeUp = computed(() => ready.value && (remainingMs.value === 0 || store.closed))

async function submit({ evenIfUnsaved = false } = {}) {
  const result = await store.submit({ evenIfUnsaved })
  if (result) {
    dialogOpen.value = false
    await goHome()
  } else if (store.voided) {
    await leave()
  }
}

// At 0 (or when the server says time is up), send what's saved without asking (ASM-03).
// Immediate: coming back to the page after the time ran out sends them straight away.
watch(
  timeUp,
  (up) => {
    if (!up) return
    dialogOpen.value = false
    void submit({ evenIfUnsaved: true })
  },
  { immediate: true },
)

function openDialog() {
  store.submitError = null
  dialogOpen.value = true
}
</script>

<template>
  <ErrorScreen
    v-if="loadError"
    title="We couldn’t load your questions"
    :message="loadError"
    :actions="[
      { label: 'Try again', onClick: load },
      { label: 'Back to home', to: { name: 'home' } },
    ]"
  />

  <div v-else class="flex min-h-dvh flex-col">
    <!-- Its own top bar: the timer stays in view, and Sign out is still there (AUTH-03). The
         progress bar is its bottom edge, so the header is exactly h-header tall. -->
    <header class="sticky top-0 z-30 bg-surface">
      <div
        class="grid h-header grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 sm:px-8 lg:px-10"
      >
        <RouterLink
          :to="{ name: 'home' }"
          class="flex min-h-11 items-center gap-2.5 justify-self-start font-display text-xl font-bold text-evergreen"
        >
          <BrandMark class="size-8" />
          <span class="sr-only sm:not-sr-only">DigiBridge</span>
        </RouterLink>
        <CountdownTimer v-if="remainingMs !== null" :remaining-ms="remainingMs" />
        <div class="col-start-3 flex min-w-0 justify-end">
          <AccountControls />
        </div>
      </div>
      <div class="absolute inset-x-0 bottom-0 h-1 bg-track" aria-hidden="true">
        <div
          class="h-full bg-evergreen transition-[width] duration-500 ease-glide"
          :style="{ width: `${progress}%` }"
        />
      </div>
    </header>

    <!-- Across the whole screen. Phones and tablets: the question, then the answers panel, with
         Back and Next stuck to the bottom. Desktops: the question on the left with Back and Next
         under it, and the answers panel on the right, full height, staying put as the page
         scrolls (the start pages' side panel, on the other side). -->
    <main
      v-if="ready && item"
      class="flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[1fr_auto] xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_24rem] 3xl:grid-cols-[minmax(0,1fr)_26rem]"
    >
      <h1 class="sr-only">Assessment</h1>

      <div
        class="px-4 pt-6 sm:px-8 sm:pt-8 lg:col-start-1 lg:row-start-1 lg:px-10 lg:py-10 xl:px-14 2xl:px-12 3xl:px-16"
      >
        <QuestionCard
          :key="item.id"
          ref="card"
          class="motion-safe:animate-enter"
          :item="item"
          :number="store.current + 1"
          :total="total"
          :picked="store.answers[item.id] ?? null"
          :save-state="store.saveStates[item.id] ?? null"
          :locked="timeUp || store.submitting"
          @pick="store.pick(item.id, $event)"
          @retry="store.retry(item.id)"
        />
      </div>

      <aside
        ref="gridSection"
        aria-labelledby="grid-title"
        tabindex="-1"
        class="mx-4 my-6 scroll-mt-[calc(var(--spacing-header)+1rem)] rounded-card border border-line bg-surface p-4 focus:outline-none sm:mx-8 sm:my-8 sm:p-5 lg:sticky lg:top-header lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:m-0 lg:flex lg:h-[calc(100svh-var(--spacing-header))] lg:flex-col lg:self-start lg:overflow-y-auto lg:rounded-none lg:border-y-0 lg:border-r-0 lg:p-6 xl:p-8"
      >
        <h2 id="grid-title" class="text-lg font-bold">Your answers</h2>
        <p class="mt-0.5 text-quiet">
          <strong class="text-ink">{{ store.answeredCount }}</strong> of {{ total }} answered
        </p>
        <QuestionGrid
          class="mt-4"
          :item-ids="store.items.map((i) => i.id)"
          :answers="store.answers"
          :save-states="store.saveStates"
          :current="store.current"
          @jump="show"
        />
        <div class="mt-5 lg:mt-auto lg:pt-6">
          <p class="mb-3 hidden text-sm text-quiet lg:block">
            You can change any answer until you submit.
          </p>
          <button
            type="button"
            :class="[SECONDARY_BUTTON, 'w-full']"
            :disabled="store.submitting"
            @click="openDialog"
          >
            Submit answers
          </button>
        </div>
      </aside>

      <div
        class="sticky bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur lg:col-start-1 lg:row-start-2"
      >
        <div
          class="flex items-center justify-between gap-3 px-4 py-3 sm:px-8 lg:px-10 xl:px-14 2xl:px-12 3xl:px-16"
        >
          <!-- Hidden, not disabled, on the first question, so Next stays in the same place. -->
          <button
            type="button"
            :class="[SECONDARY_BUTTON, 'px-4 sm:px-6', store.current === 0 && 'invisible']"
            @click="show(store.current - 1)"
          >
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              class="size-4 fill-none stroke-current stroke-[2.5]"
            >
              <path d="M10 3.5 5.5 8l4.5 4.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Back
          </button>

          <!-- Phones and tablets have the grid under the question: this takes them there. -->
          <button
            type="button"
            class="flex min-h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-quiet tabular-nums hover:bg-mist-soft lg:hidden"
            @click="showGrid"
          >
            {{ store.current + 1 }} / {{ total }}
            <span class="sr-only">, see all questions</span>
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              class="size-4 fill-none stroke-current stroke-2"
            >
              <path d="M4 6.5 8 10.5l4-4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <p
            class="hidden text-sm font-semibold text-quiet tabular-nums lg:block"
            aria-hidden="true"
          >
            {{ store.current + 1 }} / {{ total }}
          </p>

          <button
            v-if="!isLast"
            type="button"
            :class="[PRIMARY_BUTTON, 'px-4 sm:px-6']"
            @click="show(store.current + 1)"
          >
            Next
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              class="size-4 fill-none stroke-current stroke-[2.5]"
            >
              <path d="M6 3.5 10.5 8 6 12.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <button
            v-else
            type="button"
            :class="[PRIMARY_BUTTON, 'px-4 sm:px-6']"
            :disabled="store.submitting"
            @click="openDialog"
          >
            Finish
          </button>
        </div>
      </div>
    </main>

    <main v-else class="grid flex-1 place-items-center px-4" aria-busy="true">
      <p class="flex items-center gap-3 text-lg text-quiet">
        <span
          aria-hidden="true"
          class="size-5 rounded-full border-2 border-line border-t-evergreen motion-safe:animate-spin"
        />
        Loading your {{ ITEMS_PER_ATTEMPT }} questions…
      </p>
    </main>

    <SubmitDialog
      :open="dialogOpen && !timeUp"
      :total="total"
      :answered="store.answeredCount"
      :unsaved="store.unsavedCount"
      :submitting="store.submitting"
      :error="store.submitError"
      @confirm="submit()"
      @close="dialogOpen = false"
    />

    <!-- Time is up: the answers go by themselves. Covers the page so nothing else can change. -->
    <div
      v-if="timeUp"
      class="fixed inset-0 z-40 grid place-items-center bg-ink/50 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="time-up-title"
      aria-describedby="time-up-body"
    >
      <div
        class="w-full max-w-md rounded-card bg-surface p-6 text-center shadow-lg motion-safe:animate-rise sm:p-7"
      >
        <span class="mx-auto grid size-14 place-items-center rounded-full bg-marigold-soft">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            class="size-7 fill-none stroke-marigold-text stroke-2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z" />
            <path d="M12 9v4l2.5 1.5" />
            <path d="M10 2h4" />
          </svg>
        </span>
        <h2 id="time-up-title" class="mt-4 text-2xl font-bold">Time’s up</h2>
        <p id="time-up-body" class="mt-2 leading-relaxed text-quiet">
          <template v-if="store.submitError">{{ store.submitError }}</template>
          <template v-else>We’re sending your answers. This only takes a moment.</template>
        </p>
        <button
          v-if="store.submitError"
          type="button"
          :class="[PRIMARY_BUTTON, 'mt-6 w-full sm:w-auto']"
          :disabled="store.submitting"
          autofocus
          @click="submit({ evenIfUnsaved: true })"
        >
          {{ store.submitting ? 'Sending…' : 'Try again' }}
        </button>
        <span
          v-else
          aria-hidden="true"
          class="mx-auto mt-6 block size-6 rounded-full border-2 border-line border-t-evergreen motion-safe:animate-spin"
        />
      </div>
    </div>
  </div>
</template>
