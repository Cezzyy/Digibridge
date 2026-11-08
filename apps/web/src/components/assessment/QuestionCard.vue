<script setup lang="ts">
import { AREA_LABELS } from '@digibridge/shared'
import { computed, useId } from 'vue'
import type { AttemptItem, SaveState } from '../../stores/attempt'

// One question with its 4 choices as real radio buttons (ASM-01), and whether the answer saved
// (ASM-04). In the stem, a blank line starts a new paragraph, and a paragraph wrapped in “ and ”
// (a text, a post, an email) is shown as a quote, the way scenario items quote them
// (packages/db/seed/dev-questions.sql). A scenario's picture shows above the stem (ASM-06).
const props = defineProps<{
  item: AttemptItem
  number: number
  total: number
  picked: string | null
  saveState: SaveState | null
  /** Time is up or the answers are being sent: choices can't change. */
  locked?: boolean
}>()
const emit = defineEmits<{ pick: [choiceId: string]; retry: [] }>()

const id = useId()
const headingId = `${id}-heading`
const stemId = `${id}-stem`

const paragraphs = computed(() =>
  props.item.stem
    .split(/\n\s*\n/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => {
      const quoted = text.length > 2 && text.startsWith('“') && text.endsWith('”')
      return { text: quoted ? text.slice(1, -1) : text, quoted }
    }),
)

// Uploaded pictures are served by the API at /api/v1/media/:key.
const imageSrc = computed(() => {
  const url = props.item.imageUrl
  if (!url) return null
  return url.startsWith('/') ? new URL(url, import.meta.env.VITE_API_URL).href : url
})

const letter = (i: number) => String.fromCharCode(65 + i)

defineExpose({ focus: () => document.getElementById(headingId)?.focus() })
</script>

<template>
  <article :aria-labelledby="headingId" class="rounded-card border border-line bg-surface">
    <p
      class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-5 sm:px-7 sm:pt-6 2xl:border-b 2xl:border-line 2xl:px-8 2xl:py-4"
    >
      <span
        :id="headingId"
        tabindex="-1"
        class="font-display text-sm font-bold tracking-wide text-marigold-text uppercase focus:outline-none"
      >
        Question {{ number }} of {{ total }}
      </span>
      <span class="rounded-full bg-mist-soft px-3 py-1 text-sm font-semibold text-evergreen">
        {{ AREA_LABELS[item.area] }}
      </span>
    </p>

    <div class="2xl:grid 2xl:grid-cols-2 2xl:divide-x 2xl:divide-line">
      <div class="px-4 sm:px-7 2xl:px-8 2xl:py-8 3xl:px-10">
        <img
          v-if="imageSrc"
          :src="imageSrc"
          alt="Picture for this question"
          class="mt-5 max-h-80 w-auto max-w-full rounded-control border border-line 2xl:mt-0 2xl:mb-5 3xl:max-h-96"
        />

        <div :id="stemId" class="mt-4 space-y-4 2xl:mt-0">
          <template v-for="(p, i) in paragraphs" :key="i">
            <blockquote
              v-if="p.quoted"
              class="max-w-[60ch] border-l-2 border-line-strong pl-4 text-[1.0625rem] leading-relaxed whitespace-pre-line 2xl:text-lg"
            >
              {{ p.text }}
            </blockquote>
            <p
              v-else
              class="max-w-[65ch] text-xl leading-snug font-semibold whitespace-pre-line text-pretty sm:text-[1.375rem] 2xl:text-2xl 3xl:text-[1.625rem]"
            >
              {{ p.text }}
            </p>
          </template>
        </div>
      </div>

      <div class="px-4 pb-6 sm:px-7 sm:pb-7 2xl:px-8 2xl:py-8 3xl:px-10">
        <fieldset
          :aria-labelledby="`${headingId} ${stemId}`"
          :disabled="locked"
          class="mt-6 2xl:mt-0"
        >
          <div class="grid gap-2.5 2xl:gap-3">
            <label
              v-for="(choice, i) in item.choices"
              :key="choice.id"
              class="group flex min-h-14 cursor-pointer items-start gap-3.5 rounded-card border border-line bg-surface px-4 py-3 transition-[border-color,background-color,box-shadow] duration-200 hover:border-evergreen has-checked:border-evergreen has-checked:bg-evergreen-soft has-checked:shadow-[inset_0_0_0_1px_var(--color-evergreen)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-evergreen has-disabled:cursor-not-allowed has-disabled:hover:border-line 2xl:min-h-16 2xl:items-center 2xl:px-5 2xl:py-3.5"
            >
              <input
                type="radio"
                :name="id"
                :value="choice.id"
                :checked="picked === choice.id"
                class="sr-only"
                @change="emit('pick', choice.id)"
              />
              <span
                aria-hidden="true"
                class="grid size-8 shrink-0 place-items-center rounded-full border-2 border-line-strong font-display text-sm font-bold text-quiet transition-colors duration-200 group-hover:border-evergreen group-has-checked:border-evergreen group-has-checked:bg-evergreen group-has-checked:text-white 2xl:size-9"
              >
                {{ letter(i) }}
              </span>
              <span
                class="min-w-0 flex-1 pt-1 text-[1.0625rem] leading-snug 2xl:pt-0 2xl:text-lg"
                >{{ choice.label }}</span
              >
            </label>
          </div>
        </fieldset>

        <div class="mt-4 flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold">
          <p aria-live="polite" class="flex items-center gap-2">
            <template v-if="saveState === 'saving'">
              <span
                aria-hidden="true"
                class="size-3.5 rounded-full border-2 border-line border-t-evergreen motion-safe:animate-spin"
              />
              <span class="text-quiet">Saving…</span>
            </template>
            <template v-else-if="saveState === 'saved'">
              <svg
                viewBox="0 0 16 16"
                aria-hidden="true"
                class="size-4 fill-none stroke-evergreen stroke-[2.5] motion-safe:animate-pop"
              >
                <path d="M3.5 8.5l3 3 6-7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span class="text-evergreen">Saved</span>
            </template>
            <span v-else-if="saveState === 'failed'" class="text-error">
              Not saved. Check your internet connection.
            </span>
            <span v-else class="font-normal text-quiet">Pick one answer. It saves right away.</span>
          </p>
          <button
            v-if="saveState === 'failed' && !locked"
            type="button"
            class="min-h-11 rounded-control px-2 text-evergreen underline underline-offset-4 hover:bg-evergreen-soft"
            @click="emit('retry')"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  </article>
</template>
