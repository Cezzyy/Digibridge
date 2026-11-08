import { computed, onScopeDispose, ref, toValue, type MaybeRefOrGetter } from 'vue'

/**
 * Milliseconds left until `deadline` (a time on this device's clock, in ms), never below 0, or
 * null while there is no deadline. It reads the clock each tick instead of counting down, so a
 * phone that slept or a tab in the background shows the right time as soon as it wakes (ASM-09).
 */
export function useCountdown(deadline: MaybeRefOrGetter<number | null>) {
  const now = ref(Date.now())
  const timer = setInterval(() => (now.value = Date.now()), 250)
  onScopeDispose(() => clearInterval(timer))

  const remainingMs = computed(() => {
    const end = toValue(deadline)
    return end === null ? null : Math.max(0, end - now.value)
  })
  return { remainingMs }
}
