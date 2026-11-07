<script setup lang="ts">
import { AREA_LABELS, type AreaCode } from '@digibridge/shared'
import { computed, nextTick, reactive, ref, useId } from 'vue'
import { SAMPLE_QUESTIONS } from './sample-questions'

// "Try a sample question" card on the landing page: one made-up item per area, laid out like
// the real assessment. All 3 panels sit in one grid cell so the card keeps its height when the
// tab changes, and the page beside it doesn't jump. Hidden panels are `inert`: their inner boxes
// set `visible` for the fade, which would otherwise let them catch clicks on the panel shown.

const id = useId()
const current = ref(0)
const picked = reactive<Partial<Record<AreaCode, number>>>({})

const triedCount = computed(
  () => SAMPLE_QUESTIONS.filter((s) => picked[s.area] !== undefined).length,
)
const allTried = computed(() => triedCount.value === SAMPLE_QUESTIONS.length)

const letter = (i: number) => String.fromCharCode(65 + i)

type ChoiceState = 'open' | 'best' | 'wrong' | 'other'

function choiceState(area: AreaCode, answer: number, i: number): ChoiceState {
  const choice = picked[area]
  if (choice === undefined) return 'open'
  if (i === answer) return 'best'
  return i === choice ? 'wrong' : 'other'
}

const CHOICE_CLASS: Record<ChoiceState, string> = {
  open: 'cursor-pointer border-line bg-surface hover:border-evergreen hover:bg-evergreen-soft',
  best: 'border-evergreen bg-evergreen-soft',
  wrong: 'border-line-strong bg-mist-soft',
  other: 'border-line bg-surface opacity-55',
}

const BADGE_CLASS: Record<ChoiceState, string> = {
  open: 'border-line-strong text-quiet group-hover:border-evergreen group-hover:text-evergreen',
  best: 'border-evergreen bg-evergreen text-white',
  wrong: 'border-line-strong bg-surface text-quiet',
  other: 'border-line text-quiet',
}

function pick(area: AreaCode, i: number) {
  if (picked[area] === undefined) picked[area] = i
}

const tabId = (i: number) => `${id}-tab-${i}`
const panelId = (i: number) => `${id}-panel-${i}`

function show(i: number, focusTab = false) {
  current.value = (i + SAMPLE_QUESTIONS.length) % SAMPLE_QUESTIONS.length
  if (focusTab) void nextTick(() => document.getElementById(tabId(current.value))?.focus())
}

/** Moves on to the next sample not tried yet. */
function showNextUntried(from: number) {
  const n = SAMPLE_QUESTIONS.length
  const offset = Array.from({ length: n - 1 }, (_, k) => k + 1).find((k) => {
    const s = SAMPLE_QUESTIONS[(from + k) % n]
    return s !== undefined && picked[s.area] === undefined
  })
  show(from + (offset ?? 1), true)
}

// Arrow keys, Home and End move between tabs (WAI-ARIA tabs pattern).
function onTabKey(event: KeyboardEvent) {
  const target = {
    ArrowRight: current.value + 1,
    ArrowLeft: current.value - 1,
    Home: 0,
    End: SAMPLE_QUESTIONS.length - 1,
  }[event.key]
  if (target === undefined) return
  event.preventDefault()
  show(target, true)
}

const announcement = computed(() => {
  const sample = SAMPLE_QUESTIONS[current.value]
  const choice = sample && picked[sample.area]
  if (!sample || choice === undefined) return ''
  const verdict =
    choice === sample.answer
      ? 'Correct.'
      : `Not quite. The best answer is ${letter(sample.answer)}.`
  return `${verdict} ${sample.why}`
})
</script>

<template>
  <section
    :aria-labelledby="`${id}-title`"
    class="relative w-full rounded-[1.25rem] border border-line bg-surface shadow-[0_1px_0_var(--color-line),0_30px_60px_-30px_rgb(18_36_28/0.35)]"
  >
    <header class="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
      <h2 :id="`${id}-title`" class="font-display text-base font-bold">Try a sample question</h2>
      <p class="flex items-center gap-1.5 text-xs font-semibold text-quiet">
        <span class="sr-only">{{ triedCount }} of {{ SAMPLE_QUESTIONS.length }} tried</span>
        <span
          v-for="s in SAMPLE_QUESTIONS"
          :key="s.area"
          aria-hidden="true"
          class="size-2 rounded-full transition-colors duration-300"
          :class="picked[s.area] === undefined ? 'bg-line' : 'bg-marigold'"
        />
      </p>
    </header>

    <div class="px-4 pt-3">
      <div
        role="tablist"
        aria-label="Skill area"
        class="flex gap-1 rounded-control bg-mist-soft p-0.5"
        @keydown="onTabKey"
      >
        <button
          v-for="(s, i) in SAMPLE_QUESTIONS"
          :id="tabId(i)"
          :key="s.area"
          type="button"
          role="tab"
          :aria-selected="current === i"
          :aria-controls="panelId(i)"
          :tabindex="current === i ? 0 : -1"
          :title="AREA_LABELS[s.area]"
          class="min-h-8 flex-1 rounded-[0.375rem] px-1.5 text-[0.8125rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-evergreen"
          :class="
            current === i
              ? 'bg-surface text-evergreen shadow-[0_1px_2px_rgb(18_36_28/0.12)]'
              : 'text-quiet hover:text-ink'
          "
          @click="show(i)"
        >
          {{ s.tab }}
        </button>
      </div>
    </div>

    <div class="grid px-4 pt-3 pb-3.5">
      <div
        v-for="(s, i) in SAMPLE_QUESTIONS"
        :id="panelId(i)"
        :key="s.area"
        role="tabpanel"
        :aria-labelledby="tabId(i)"
        :inert="current !== i"
        class="col-start-1 row-start-1 transition-[opacity,translate,visibility] duration-300 ease-out motion-reduce:transition-none"
        :class="current === i ? 'visible opacity-100' : 'invisible translate-y-1 opacity-0'"
      >
        <!-- The scenario, drawn like a phone screenshot. Once answered, the explanation takes
             its place in the same grid cell, so the card keeps its height. -->
        <div class="grid">
          <div
            class="col-start-1 row-start-1 transition-opacity duration-300 motion-reduce:transition-none"
            :class="picked[s.area] === undefined ? 'visible opacity-100' : 'invisible opacity-0'"
          >
            <figure v-if="s.scene === 'sms'" class="rounded-card bg-mist-soft p-3">
              <figcaption class="sr-only">A text message from an unknown number:</figcaption>
              <div class="flex items-center gap-2 text-xs text-quiet">
                <span
                  class="grid size-6 place-items-center rounded-full bg-line"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 16 16" class="size-3 fill-quiet">
                    <circle cx="8" cy="5.5" r="3" />
                    <path d="M2.5 14.5c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5z" />
                  </svg>
                </span>
                <span class="font-semibold text-ink">+63 9•• ••• 0457</span>
                <span class="ml-auto">Today, 9:41 AM</span>
              </div>
              <p
                class="mt-2 w-fit max-w-[36ch] rounded-2xl rounded-tl-md bg-surface px-3 py-2 text-sm leading-snug shadow-[0_1px_2px_rgb(18_36_28/0.08)]"
              >
                ALERT: Your e-wallet will be LOCKED today because of unusual activity. Verify now to
                keep your balance:
                <span
                  class="font-semibold whitespace-nowrap text-evergreen underline underline-offset-2"
                >
                  ewallet-verify.help/login
                </span>
              </p>
            </figure>

            <figure v-else-if="s.scene === 'post'" class="rounded-card border border-line p-3">
              <figcaption class="sr-only">A social media post:</figcaption>
              <div class="flex items-center gap-2.5">
                <span
                  class="grid size-8 shrink-0 place-items-center rounded-full bg-marigold font-display text-xs font-bold text-ink"
                  aria-hidden="true"
                >
                  MU
                </span>
                <div class="min-w-0">
                  <p class="truncate text-sm leading-tight font-semibold">Metro Updates 24/7</p>
                  <p class="text-xs text-quiet">2h · Public</p>
                </div>
              </div>
              <p class="mt-2 text-sm leading-snug">
                <span class="font-bold">BREAKING:</span> NO CLASSES in all schools tomorrow!! Share
                so your classmates know!!
              </p>
              <p class="mt-2 flex flex-wrap gap-x-4 border-t border-line pt-1.5 text-xs text-quiet">
                <span>1.2K reactions</span><span>486 comments</span><span>4.8K shares</span>
              </p>
            </figure>

            <figure v-else class="space-y-2 rounded-card bg-mist-soft p-3">
              <figcaption class="text-xs font-semibold text-quiet">
                <span class="sr-only">A group chat:</span> Research group · 5 members
              </figcaption>
              <div class="flex items-end gap-2">
                <span
                  class="grid size-6 shrink-0 place-items-center rounded-full bg-level-2 text-[0.625rem] font-bold"
                  aria-hidden="true"
                >
                  JL
                </span>
                <p class="rounded-2xl rounded-bl-md bg-surface px-3 py-1.5 text-sm leading-snug">
                  Report is due Friday. How do we all work on it?
                </p>
              </div>
              <div class="flex items-end gap-2">
                <span
                  class="grid size-6 shrink-0 place-items-center rounded-full bg-marigold-soft text-[0.625rem] font-bold"
                  aria-hidden="true"
                >
                  AN
                </span>
                <p class="rounded-2xl rounded-bl-md bg-surface px-3 py-1.5 text-sm leading-snug">
                  Last time two of us wrote the same part.
                </p>
              </div>
            </figure>
          </div>

          <div
            class="col-start-1 row-start-1 flex flex-col rounded-card bg-marigold-soft p-3 transition-[opacity,translate] duration-300 motion-reduce:transition-none"
            :class="
              picked[s.area] === undefined
                ? 'invisible translate-y-1 opacity-0'
                : 'visible opacity-100'
            "
          >
            <p class="font-display font-bold">
              {{
                picked[s.area] === s.answer
                  ? 'That’s right.'
                  : `Not quite. The best answer is ${letter(s.answer)}.`
              }}
            </p>
            <p class="mt-1 text-sm leading-snug">{{ s.why }}</p>
            <p class="mt-auto pt-2">
              <RouterLink
                v-if="allTried"
                :to="{ name: 'sign-in' }"
                class="inline-flex min-h-8 items-center gap-1 text-sm font-semibold text-evergreen underline-offset-4 hover:underline"
              >
                Take the real one <span aria-hidden="true">→</span>
              </RouterLink>
              <button
                v-else
                type="button"
                class="inline-flex min-h-8 items-center gap-1 text-sm font-semibold text-evergreen underline-offset-4 hover:underline"
                @click="showNextUntried(i)"
              >
                Next sample <span aria-hidden="true">→</span>
              </button>
            </p>
          </div>
        </div>

        <p :id="`${panelId(i)}-q`" class="mt-3 text-[0.9375rem] leading-snug font-semibold">
          {{ s.question }}
        </p>

        <ul class="mt-2 grid gap-1.5" :aria-labelledby="`${panelId(i)}-q`">
          <li v-for="(text, c) in s.choices" :key="c">
            <button
              type="button"
              class="group flex min-h-10 w-full items-center gap-2.5 rounded-control border px-2.5 py-1.5 text-left text-sm leading-snug transition-[background-color,border-color,opacity] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-evergreen"
              :class="CHOICE_CLASS[choiceState(s.area, s.answer, c)]"
              :aria-disabled="picked[s.area] !== undefined"
              @click="pick(s.area, c)"
            >
              <span
                class="grid size-6 shrink-0 place-items-center rounded-full border-2 text-[0.6875rem] font-bold transition-colors"
                :class="BADGE_CLASS[choiceState(s.area, s.answer, c)]"
                aria-hidden="true"
              >
                <svg
                  v-if="choiceState(s.area, s.answer, c) === 'best'"
                  viewBox="0 0 16 16"
                  class="size-3 fill-none stroke-white stroke-[2.5]"
                >
                  <path d="M3.5 8.5l3 3 6-7" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <svg
                  v-else-if="choiceState(s.area, s.answer, c) === 'wrong'"
                  viewBox="0 0 16 16"
                  class="size-3 fill-none stroke-quiet stroke-[2.5]"
                >
                  <path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round" />
                </svg>
                <template v-else>{{ letter(c) }}</template>
              </span>
              <span class="sr-only">{{ letter(c) }}.</span>
              <span class="min-w-0 flex-1">{{ text }}</span>
              <span
                v-if="picked[s.area] === c"
                class="shrink-0 text-xs font-semibold"
                :class="c === s.answer ? 'text-evergreen' : 'text-quiet'"
              >
                Your answer
              </span>
            </button>
          </li>
        </ul>

        <p class="mt-2.5 text-xs text-quiet">Sample only. The real questions are different.</p>
      </div>
    </div>

    <p class="sr-only" aria-live="polite">{{ announcement }}</p>
  </section>
</template>
