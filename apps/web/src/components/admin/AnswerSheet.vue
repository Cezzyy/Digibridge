<script setup lang="ts">
import { AREA_CODES, AREA_LABELS, DIFFICULTY_LABELS } from '@digibridge/shared'
import { computed } from 'vue'
import type { AnsweredItem } from '../../composables/useRespondent'
import { ICONS } from './admin-icons'
import StrokeIcon from './StrokeIcon.vue'

// A respondent's answers, admins only (DSH-05): each area's items in the order they were shown,
// with every choice, the one picked and the right one. Respondents never see this.
const props = defineProps<{ items: readonly AnsweredItem[] }>()

/** Each item's number in the order the respondent saw them. */
const numberOf = computed(() => new Map(props.items.map((item, i) => [item.questionId, i + 1])))

const areas = computed(() =>
  AREA_CODES.map((area) => {
    const items = props.items.filter((item) => item.area === area)
    return {
      area,
      items,
      right: items.filter((item) => item.correct).length,
      unanswered: items.filter((item) => item.pickedChoiceId === null).length,
    }
  }).filter((group) => group.items.length > 0),
)

const LETTERS = ['A', 'B', 'C', 'D']
</script>

<template>
  <div class="space-y-6">
    <section v-for="group in areas" :key="group.area" :aria-labelledby="`sheet-${group.area}`">
      <div class="flex flex-wrap items-baseline justify-between gap-x-3">
        <h4 :id="`sheet-${group.area}`" class="font-bold">{{ AREA_LABELS[group.area] }}</h4>
        <p class="text-sm text-quiet">
          {{ group.right }} of {{ group.items.length }} right<template v-if="group.unanswered">
            · {{ group.unanswered }} left blank</template
          >
        </p>
      </div>
      <ol class="mt-3 space-y-3">
        <li
          v-for="item in group.items"
          :key="item.questionId"
          class="rounded-card border p-4"
          :class="item.correct ? 'border-line' : 'border-error/40'"
        >
          <div class="flex items-start gap-3">
            <span
              class="grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums"
              :class="
                item.correct ? 'bg-evergreen-soft text-evergreen' : 'bg-error-soft text-error'
              "
            >
              {{ numberOf.get(item.questionId) }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-quiet">
                {{ DIFFICULTY_LABELS[item.difficulty] }}
                ·
                <template v-if="item.pickedChoiceId === null">Left blank</template>
                <template v-else-if="item.correct">Right, {{ item.points ?? 0 }} pt</template>
                <template v-else>Wrong</template>
              </p>
              <p class="mt-1 whitespace-pre-line">{{ item.stem }}</p>
              <ul class="mt-3 space-y-1.5">
                <li
                  v-for="(choice, i) in item.choices"
                  :key="choice.id"
                  class="flex items-start gap-2.5 rounded-control px-2.5 py-1.5"
                  :class="[
                    choice.isCorrect && 'bg-evergreen-soft',
                    choice.id === item.pickedChoiceId && !choice.isCorrect && 'bg-error-soft',
                  ]"
                >
                  <span class="w-4 shrink-0 font-semibold text-quiet">{{ LETTERS[i] }}</span>
                  <span class="min-w-0 flex-1">{{ choice.label }}</span>
                  <span
                    v-if="choice.id === item.pickedChoiceId"
                    class="flex shrink-0 items-center gap-1 text-sm font-semibold"
                    :class="choice.isCorrect ? 'text-evergreen' : 'text-error'"
                  >
                    <StrokeIcon :d="choice.isCorrect ? ICONS.check : ICONS.close" class="size-4" />
                    Picked
                  </span>
                  <span
                    v-else-if="choice.isCorrect"
                    class="shrink-0 text-sm font-semibold text-evergreen"
                  >
                    Right answer
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </li>
      </ol>
    </section>
  </div>
</template>
