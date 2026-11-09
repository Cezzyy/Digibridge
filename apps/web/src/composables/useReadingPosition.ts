import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

// How far down the top of the screen a section's heading must come before it counts as the
// one being read: below the sticky top bar, with some room to spare.
const READ_LINE = 140

/**
 * Where the student is in a lesson: `progress` from 0 (the article's top at the top of the
 * screen) to 1 (its end in view), and `activeId`, the last of `ids` whose section has reached
 * the top of the screen. Both follow scrolling and resizing, at most once a frame.
 */
export function useReadingPosition(article: Ref<HTMLElement | null>, ids: Ref<string[]>) {
  const progress = ref(0)
  const activeId = ref<string | null>(null)
  let frame = 0

  function measure() {
    frame = 0
    const el = article.value
    if (!el) return
    const box = el.getBoundingClientRect()
    const travel = box.height - window.innerHeight
    progress.value = travel > 0 ? Math.min(Math.max(-box.top / travel, 0), 1) : box.top <= 0 ? 1 : 0

    let active: string | null = null
    for (const id of ids.value) {
      const section = document.getElementById(id)
      if (section && section.getBoundingClientRect().top <= READ_LINE) active = id
    }
    // At the very end, the last part counts even if it's too short to reach the top.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      active = ids.value.at(-1) ?? active
    }
    activeId.value = active
  }

  const schedule = () => {
    frame ||= requestAnimationFrame(measure)
  }

  onMounted(() => {
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    schedule()
  })
  onBeforeUnmount(() => {
    window.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', schedule)
    cancelAnimationFrame(frame)
  })

  return { progress, activeId, refresh: schedule }
}
