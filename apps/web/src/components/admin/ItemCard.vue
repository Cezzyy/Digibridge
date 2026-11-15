<script setup lang="ts">
import {
  DIFFICULTY_LABELS,
  ITEM_FLAG_DESCRIPTIONS,
  ITEM_FLAG_LABELS,
  ITEM_FLAG_MIN_SEEN,
} from '@digibridge/shared'
import { computed } from 'vue'
import type { ItemStats } from '../../composables/useItemAnalysis'
import { ICONS } from './admin-icons'
import { countText, pctText, shareOf } from './stats-text'
import StrokeIcon from './StrokeIcon.vue'

// One question in item analysis (DSH-08): its percent correct, how many saw it, its flags with
// what each means, and each choice with how often it was picked (the right one marked). Bars are
// shares of everyone who saw the item, so blanks show as what's left over. Edit question opens it
// in the questions editor.
const props = defineProps<{ item: ItemStats }>()

const LETTERS = ['A', 'B', 'C', 'D']
const tooFew = computed(() => props.item.seen > 0 && props.item.seen < ITEM_FLAG_MIN_SEEN)
</script>

<template>
  <article
    class="rounded-card border bg-surface p-5"
    :class="item.flags.length ? 'border-marigold' : 'border-line'"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <p class="flex flex-wrap items-center gap-2 text-sm font-semibold text-quiet">
        {{ DIFFICULTY_LABELS[item.difficulty] }}
        <span v-if="!item.isActive" class="rounded-full bg-mist-soft px-2.5 py-0.5"
          >Not in use</span
        >
      </p>
      <p class="text-right">
        <span class="font-display text-2xl font-bold tabular-nums">{{
          pctText(item.correctPct)
        }}</span>
        <span class="block text-sm text-quiet">
          right ·
          {{
            item.seen === 0 ? 'not seen yet' : `seen by ${countText(item.seen, 'person', 'people')}`
          }}
        </span>
      </p>
    </div>

    <p class="mt-2 line-clamp-4 whitespace-pre-line">{{ item.stem }}</p>

    <ul v-if="item.flags.length" class="mt-3 flex flex-wrap gap-2">
      <li
        v-for="flag in item.flags"
        :key="flag"
        class="flex items-center gap-1.5 rounded-full bg-marigold-soft px-3 py-1 text-sm font-semibold text-marigold-text"
        :title="ITEM_FLAG_DESCRIPTIONS[flag]"
      >
        <StrokeIcon :d="ICONS.clock" class="size-4" />
        {{ ITEM_FLAG_LABELS[flag] }}
        <span class="sr-only">: {{ ITEM_FLAG_DESCRIPTIONS[flag] }}</span>
      </li>
    </ul>
    <p v-else-if="tooFew" class="mt-3 text-sm text-quiet">
      Flags show once {{ ITEM_FLAG_MIN_SEEN }} people have seen it.
    </p>

    <ul class="mt-4 space-y-2">
      <li v-for="(choice, i) in item.choices" :key="choice.id">
        <div class="flex items-start justify-between gap-3 text-sm">
          <span class="flex min-w-0 gap-2">
            <span class="w-4 shrink-0 font-semibold text-quiet">{{ LETTERS[i] }}</span>
            <span class="min-w-0" :class="{ 'font-semibold': choice.isCorrect }">{{
              choice.label
            }}</span>
          </span>
          <span class="flex shrink-0 items-center gap-1.5 font-semibold tabular-nums">
            <span v-if="choice.isCorrect" class="flex items-center gap-1 text-evergreen">
              <StrokeIcon :d="ICONS.check" class="size-4" />
              Right
            </span>
            {{ choice.picked }}
          </span>
        </div>
        <span class="mt-1 ml-6 block h-2 rounded-[4px] bg-track" aria-hidden="true">
          <span
            v-if="choice.picked"
            class="block h-full rounded-[4px]"
            :class="choice.isCorrect ? 'bg-evergreen' : 'bg-line-strong'"
            :style="{ width: `${shareOf(choice.picked, item.seen)}%` }"
          />
        </span>
      </li>
    </ul>
    <p v-if="item.blank" class="mt-2 ml-6 text-sm text-quiet">{{ item.blank }} left it blank</p>

    <RouterLink
      :to="{ name: 'admin-question', params: { id: item.questionId } }"
      class="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-evergreen hover:underline"
    >
      Edit question
    </RouterLink>
  </article>
</template>
