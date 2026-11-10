<script setup lang="ts">
import {
  SUS_ANSWER_LABELS,
  SUS_STATEMENT_COUNT,
  SUS_STATEMENTS,
  type SusAnswers,
} from '@digibridge/shared'
import { computed, nextTick, ref, useId, useTemplateRef } from 'vue'
import { useSaveSus } from '../composables/useSaveSus'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../lib/buttons'

// The usability survey (SUS-01): the 10 statements, each a row of 5 radio buttons from
// 1 (Strongly disagree) to 5 (Strongly agree), then Send and Skip. Answers are sent together;
// once saved, the card thanks the student in place and emits `saved`. Skip only emits `skip`:
// the page decides what that hides. Online it's an optional card under the results (SUS-02);
// kiosk mode will open it after results (SUS-03).

const props = defineProps<{ attemptId: string }>()
const emit = defineEmits<{ saved: []; skip: [] }>()

const { save, saving, error } = useSaveSus()

const id = useId()
const answers = ref<(number | null)[]>(Array.from({ length: SUS_STATEMENT_COUNT }, () => null))
// Set by the first Send, so blank statements are flagged only once the student tries to send.
const tried = ref(false)
const done = ref(false)
const thanks = useTemplateRef('thanks')

const answered = computed(() => answers.value.filter((a) => a !== null).length)
const blank = computed(() => SUS_STATEMENT_COUNT - answered.value)
const missing = (i: number) => tried.value && answers.value[i] === null

const statementId = (i: number) => `${id}-s${i}`
const errorId = (i: number) => `${id}-e${i}`
const number = (i: number) => String(i + 1).padStart(2, '0')

async function send() {
  tried.value = true
  const first = answers.value.indexOf(null)
  if (first !== -1) {
    document.getElementById(statementId(first))?.querySelector('input')?.focus()
    return
  }
  // Every answer is picked here, so this is the full list.
  if (!(await save(props.attemptId, answers.value as SusAnswers))) return
  done.value = true
  emit('saved')
  await nextTick()
  thanks.value?.focus()
}
</script>

<template>
  <section
    v-if="done"
    aria-labelledby="sus-thanks"
    class="flex gap-4 rounded-card border border-line bg-evergreen-soft p-5 sm:p-7"
  >
    <span
      aria-hidden="true"
      class="grid size-10 shrink-0 place-items-center rounded-full bg-evergreen text-white"
    >
      <svg
        viewBox="0 0 24 24"
        class="size-5 fill-none stroke-current stroke-[2.5]"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
    <div>
      <h2
        id="sus-thanks"
        ref="thanks"
        tabindex="-1"
        class="text-xl leading-snug font-bold focus:outline-none"
      >
        Thanks for rating DigiBridge
      </h2>
      <p class="mt-1 leading-relaxed text-quiet">
        Your ratings help the research team make DigiBridge better for students.
      </p>
    </div>
  </section>

  <section
    v-else
    aria-labelledby="sus-title"
    class="rounded-card border border-line bg-surface p-5 sm:p-7"
  >
    <p class="text-sm font-semibold text-marigold-text">Optional · about 2 minutes</p>
    <h2 id="sus-title" class="mt-1 text-2xl leading-tight font-bold sm:text-3xl">
      Rate DigiBridge
    </h2>
    <p class="mt-1 max-w-[68ch] leading-relaxed text-quiet">
      How easy was DigiBridge to use? Rate each statement from 1 (Strongly disagree) to 5 (Strongly
      agree). There are no right or wrong answers, and your ratings help the research team make it
      better.
    </p>

    <form novalidate class="mt-6" @submit.prevent="send">
      <ol class="grid gap-x-10 gap-y-7 xl:grid-cols-2">
        <li v-for="(statement, i) in SUS_STATEMENTS" :key="i">
          <fieldset
            :id="statementId(i)"
            :aria-describedby="missing(i) ? errorId(i) : undefined"
            :data-invalid="missing(i) ? '' : undefined"
          >
            <legend class="flex gap-3 leading-snug font-semibold">
              <span class="font-display text-marigold-text tabular-nums">{{ number(i) }}</span>
              <span>{{ statement }}</span>
            </legend>

            <div class="mt-3 max-w-xs sm:ml-9">
              <div class="grid grid-cols-5 gap-2">
                <label
                  v-for="(label, v) in SUS_ANSWER_LABELS"
                  :key="label"
                  class="grid h-12 cursor-pointer place-items-center rounded-control border bg-surface transition-[border-color,background-color,color] duration-200 hover:border-evergreen has-checked:border-evergreen has-checked:bg-evergreen has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-evergreen"
                  :class="missing(i) ? 'border-error' : 'border-line-strong'"
                >
                  <input
                    v-model="answers[i]"
                    type="radio"
                    :name="statementId(i)"
                    :value="v + 1"
                    class="sr-only"
                  />
                  <span class="font-display text-lg font-bold tabular-nums">{{ v + 1 }}</span>
                  <span class="sr-only">{{ label }}</span>
                </label>
              </div>
              <div aria-hidden="true" class="mt-1.5 flex justify-between text-xs text-quiet">
                <span>{{ SUS_ANSWER_LABELS[0] }}</span>
                <span>{{ SUS_ANSWER_LABELS[SUS_ANSWER_LABELS.length - 1] }}</span>
              </div>
              <p v-if="missing(i)" :id="errorId(i)" class="mt-2 text-sm font-semibold text-error">
                Pick a number for this one.
              </p>
            </div>
          </fieldset>
        </li>
      </ol>

      <p
        v-if="error || (tried && blank > 0)"
        role="alert"
        class="mt-7 rounded-control bg-error-soft px-4 py-3 font-semibold text-error"
      >
        <template v-if="error">{{ error }}</template>
        <template v-else>
          {{ blank === 1 ? '1 statement is' : `${blank} statements are` }} still blank. Pick a
          number for each one.
        </template>
      </p>

      <div
        class="mt-7 flex flex-col-reverse gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="text-sm text-quiet tabular-nums">
          {{ answered }} of {{ SUS_STATEMENT_COUNT }} answered
        </p>
        <div class="flex flex-col gap-3 sm:flex-row-reverse">
          <button type="submit" :class="PRIMARY_BUTTON" :disabled="saving">
            {{ saving ? 'Sending…' : 'Send my ratings' }}
          </button>
          <button type="button" :class="SECONDARY_BUTTON" :disabled="saving" @click="emit('skip')">
            Skip for now
          </button>
        </div>
      </div>
    </form>
  </section>
</template>
