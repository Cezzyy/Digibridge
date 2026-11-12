<script setup lang="ts">
import {
  AREA_CODES,
  AREA_LABELS,
  ITEM_EASY_MIN_PCT,
  ITEM_FLAG_MIN_SEEN,
  ITEM_HARD_BELOW_PCT,
  type AreaCode,
} from '@digibridge/shared'
import { computed, onMounted, ref, watch } from 'vue'
import ErrorPanel from '../../components/admin/ErrorPanel.vue'
import FilterBar from '../../components/admin/FilterBar.vue'
import ItemCard from '../../components/admin/ItemCard.vue'
import ItemCardSkeleton from '../../components/admin/ItemCardSkeleton.vue'
import { useDashboardFilters } from '../../composables/useDashboardFilters'
import { useItemAnalysis } from '../../composables/useItemAnalysis'
import { useSchoolLinks } from '../../composables/useSchoolLinks'

// Item analysis (DSH-08), admin only: each area's questions with their percent correct, how
// often each choice was picked, and flags for items that look too easy, too hard or confusing.
// Follows the dashboard filters; counts finished attempts only. It can move into the questions
// page once that's built.
const { filters } = useDashboardFilters()
const { items, error, loading, load } = useItemAnalysis()
const schoolLinks = useSchoolLinks()
onMounted(() => void schoolLinks.load())

watch(
  () => JSON.stringify(filters.value),
  () => load(filters.value),
  { immediate: true },
)

const area = ref<AreaCode>(AREA_CODES[0])
const flaggedOnly = ref(false)

const counts = computed(
  () =>
    Object.fromEntries(
      AREA_CODES.map((code) => [
        code,
        items.value?.filter((item) => item.area === code && item.flags.length).length ?? 0,
      ]),
    ) as Record<AreaCode, number>,
)
const shown = computed(() =>
  items.value?.filter(
    (item) => item.area === area.value && (!flaggedOnly.value || item.flags.length > 0),
  ),
)
</script>

<template>
  <div>
    <h1 class="text-3xl leading-tight font-bold sm:text-4xl">Item analysis</h1>
    <p class="mt-2 max-w-3xl text-lg text-quiet">
      How each question did. Too easy means {{ ITEM_EASY_MIN_PCT }}% or more got it right, too hard
      fewer than {{ ITEM_HARD_BELOW_PCT }}%, and confusing a wrong choice picked more than the right
      one. Flags show once {{ ITEM_FLAG_MIN_SEEN }} people have seen an item.
    </p>
  </div>

  <FilterBar class="mt-8" :links="schoolLinks.links.value ?? []" />

  <div class="mt-6 flex flex-wrap items-center justify-between gap-3">
    <div
      role="group"
      aria-label="Area"
      class="flex flex-wrap gap-1 rounded-card border border-line bg-surface p-1"
    >
      <button
        v-for="code in AREA_CODES"
        :key="code"
        type="button"
        :aria-pressed="area === code"
        class="flex min-h-11 items-center gap-2 rounded-control px-3 font-semibold text-quiet transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-evergreen aria-pressed:bg-evergreen-soft aria-pressed:text-evergreen"
        @click="area = code"
      >
        {{ AREA_LABELS[code] }}
        <span
          v-if="counts[code]"
          class="rounded-full bg-marigold-soft px-2 text-sm text-marigold-text tabular-nums"
        >
          {{ counts[code] }}<span class="sr-only"> flagged</span>
        </span>
      </button>
    </div>
    <label class="flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
      <input v-model="flaggedOnly" type="checkbox" class="size-5 accent-evergreen" />
      Flagged only
    </label>
  </div>

  <ErrorPanel v-if="error" class="mt-4" :message="error" @retry="load(filters)" />

  <ul v-else-if="!shown" class="mt-4 grid gap-4 lg:grid-cols-2" aria-busy="true">
    <li v-for="n in 6" :key="n"><ItemCardSkeleton :variant="n" class="h-full" /></li>
    <li class="sr-only">Loading items</li>
  </ul>

  <p
    v-else-if="shown.length === 0"
    class="mt-4 rounded-card border border-dashed border-line-strong/60 p-6 text-quiet"
  >
    {{ flaggedOnly ? 'No flagged items in this area.' : 'No questions in this area yet.' }}
  </p>

  <ul v-else class="mt-4 grid gap-4 lg:grid-cols-2" :class="{ 'opacity-60': loading }">
    <li v-for="item in shown" :key="item.questionId"><ItemCard :item="item" class="h-full" /></li>
  </ul>
</template>
