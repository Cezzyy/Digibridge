import type { ObjectDirective } from 'vue'

// Scroll reveals and small JS animations. Every one of them is skipped when the user's system
// asks for less motion.

/** True when the system asks for less motion. Check it each time an animation starts. */
export const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// One observer for the whole app. Each element is watched until it first scrolls in; an element
// can have more than one callback (a reveal and a component's own animation, say).
const callbacks = new Map<Element, Set<() => void>>()
let observer: IntersectionObserver | undefined

/** Calls `callback` once, the first time `el` scrolls into view. Returns a stop function. */
export function onFirstView(el: Element, callback: () => void): () => void {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        observer?.unobserve(entry.target)
        const waiting = callbacks.get(entry.target)
        callbacks.delete(entry.target)
        waiting?.forEach((call) => call())
      }
    },
    // Wait until the element is a little way up the screen, not just peeking in.
    { rootMargin: '0px 0px -12% 0px' },
  )
  const waiting = callbacks.get(el) ?? new Set()
  waiting.add(callback)
  callbacks.set(el, waiting)
  observer.observe(el)

  return () => {
    waiting.delete(callback)
    if (waiting.size > 0) return
    callbacks.delete(el)
    observer?.unobserve(el)
  }
}

export type RevealFrom = 'up' | 'left' | 'right' | 'scale'

const stopReveal = new WeakMap<HTMLElement, () => void>()

/**
 * `v-reveal`, `v-reveal:left`, `v-reveal:scale="200"`: the element slides in from below (or the
 * left, the right, or grows) the first time it scrolls into view. The value is a delay in ms.
 * It uses data attributes, not classes, so Vue's own `:class` updates can't undo it. Styles are
 * in style.css.
 */
export const vReveal: ObjectDirective<HTMLElement, number | undefined, string, RevealFrom> = {
  beforeMount(el, { arg, value }) {
    el.dataset.reveal = arg ?? 'up'
    if (value) el.style.setProperty('--reveal-delay', `${value}ms`)
  },
  mounted(el) {
    stopReveal.set(
      el,
      onFirstView(el, () => (el.dataset.revealed = '')),
    )
  },
  beforeUnmount(el) {
    stopReveal.get(el)?.()
  },
}

/**
 * Calls `frame` on every animation frame for `ms`, with progress from 0 to 1 on an ease-out
 * curve, starting after `delay` ms. Returns a function that cancels it.
 */
export function tween(ms: number, frame: (t: number) => void, delay = 0): () => void {
  let raf = 0
  let start: number | undefined
  const tick = (now: number) => {
    start ??= now + delay
    const t = Math.min(Math.max((now - start) / ms, 0), 1)
    frame(1 - (1 - t) ** 3)
    if (t < 1) raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}
