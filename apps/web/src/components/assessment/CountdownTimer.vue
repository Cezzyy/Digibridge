<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useCountdown } from '../../composables/useCountdown'

// The time left, always in view at the top of the assessment (ASM-03). Calm until 5 minutes,
// marigold from 5 minutes, red in the last minute (docs/design.md). The page works out the
// deadline from the server's clock and submits at 0; this only shows it. It ticks on its own so
// only the timer re-renders each tick, not the whole page.
const props = defineProps<{ deadline: number }>()
const { remainingMs: left } = useCountdown(() => props.deadline)
const remainingMs = computed(() => left.value ?? 0)

const WARN_MS = 5 * 60_000
const DANGER_MS = 60_000

type Tone = 'calm' | 'warn' | 'danger'
const tone = computed<Tone>(() =>
  remainingMs.value <= DANGER_MS ? 'danger' : remainingMs.value <= WARN_MS ? 'warn' : 'calm',
)

const TONE_CLASS: Record<Tone, string> = {
  calm: 'bg-mist-soft text-ink ring-line',
  warn: 'bg-marigold-soft text-marigold-text ring-marigold',
  danger: 'bg-error-soft text-error ring-error',
}
const ICON_CLASS: Record<Tone, string> = {
  calm: 'stroke-evergreen',
  warn: 'stroke-marigold-text',
  danger: 'stroke-error',
}

const seconds = computed(() => Math.ceil(remainingMs.value / 1000))
const clock = computed(() => {
  const s = seconds.value
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
})
const spoken = computed(() => {
  const m = Math.floor(seconds.value / 60)
  const s = seconds.value % 60
  const parts = [m && `${m} minute${m === 1 ? '' : 's'}`, s && `${s} second${s === 1 ? '' : 's'}`]
  return parts.filter(Boolean).join(' ') || 'no time'
})

// A timer is quiet for screen readers, so say it once when it turns marigold and when it turns red.
const announcement = ref('')
watch(tone, (next, before) => {
  if (next === 'warn' && before === 'calm') announcement.value = '5 minutes left.'
  if (next === 'danger') announcement.value = '1 minute left. Your answers are sent at 0.'
})
</script>

<template>
  <span class="inline-flex">
    <span
      role="timer"
      :aria-label="`Time left: ${spoken}`"
      class="inline-flex min-h-10 items-center gap-2 rounded-full px-3.5 font-display text-lg font-bold tabular-nums ring-1 transition-colors duration-500 ring-inset"
      :class="TONE_CLASS[tone]"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        class="size-5 fill-none stroke-2"
        :class="ICON_CLASS[tone]"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z" />
        <path d="M12 9v4l2.5 1.5" />
        <path d="M10 2h4" />
      </svg>
      <span aria-hidden="true">{{ clock }}</span>
    </span>
    <span class="sr-only" aria-live="assertive">{{ announcement }}</span>
  </span>
</template>
