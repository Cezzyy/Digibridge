<script setup lang="ts">
import { ITEMS_PER_ATTEMPT, type AreaCode } from '@digibridge/shared'
import { computed, ref } from 'vue'
import type { AttemptItem } from '../../stores/attempt'
import QuestionCard from '../assessment/QuestionCard.vue'

// The questions editor's preview (CMS-01): the question drawn with the assessment's own
// QuestionCard, so paragraphs, quotes and the picture look as they will for students. Students
// only see the light theme, so it keeps it (`.light-theme`) in a dark admin area too. A choice
// can be picked to try it, as a student would; nothing is saved. The choices show in the editor's
// order here, though each student gets them shuffled (ASM-02). A picture link that isn't https
// yet shows nothing.

const props = defineProps<{
  area: AreaCode
  stem: string
  imageUrl: string
  isScenario: boolean
  choices: string[]
}>()

const isHttpsLink = (url: string) => {
  try {
    return new URL(url.trim()).protocol === 'https:'
  } catch {
    return false
  }
}

const item = computed<AttemptItem>(() => ({
  id: 'preview',
  area: props.area,
  stem: props.stem.trim() || 'Your question shows here.',
  imageUrl: isHttpsLink(props.imageUrl) ? props.imageUrl.trim() : null,
  isScenario: props.isScenario,
  choices: props.choices.map((label, i) => ({
    id: String(i),
    label: label.trim() || `Choice ${String.fromCharCode(65 + i)}`,
  })),
}))

const picked = ref<string | null>(null)
</script>

<template>
  <div class="light-theme bg-mist p-4 sm:p-6">
    <QuestionCard
      :item="item"
      :number="1"
      :total="ITEMS_PER_ATTEMPT"
      :picked="picked"
      :save-state="null"
      @pick="picked = $event"
    />
  </div>
</template>
