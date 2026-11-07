<script setup lang="ts">
import { AREA_CODES, AREA_LABELS, ITEMS_PER_AREA, type AreaCode } from '@digibridge/shared'
import { computed, ref, useTemplateRef } from 'vue'
import AreaScene from './AreaScene.vue'

// "What it checks" as slides, one per area. Move with the arrow buttons, the area buttons, the
// arrow keys, or by swiping (or dragging) the slides. The next slide peeks in at the side.

const AREA_DETAILS: Record<AreaCode, { summary: string; topics: string[] }> = {
  info_literacy: {
    summary: 'Finding what you need online, and knowing whether you can trust it.',
    topics: ['Searching smarter', 'Telling real news from fake', 'Keeping files and data in order'],
  },
  communication: {
    summary: 'Working with others online, and knowing how to act in chats, groups and classes.',
    topics: [
      'Working on shared files',
      'Netiquette in chats and classes',
      'Your digital footprint',
    ],
  },
  safety: {
    summary: 'Keeping your accounts, your devices, your personal data and yourself safe.',
    topics: [
      'Scam texts and fake links',
      'Passwords and privacy settings',
      'Screen time and wellbeing',
    ],
  },
}

const props = defineProps<{ labelledby: string }>()

const LAST = AREA_CODES.length - 1
const active = ref(0)
/** 1 going forward, -1 going back: the side the new slide's text slides in from. */
const direction = ref<1 | -1>(1)

function go(i: number) {
  const next = Math.min(Math.max(i, 0), LAST)
  if (next === active.value) return
  direction.value = next > active.value ? 1 : -1
  active.value = next
}

const number = (i: number) => String(i + 1).padStart(2, '0')

const announcement = computed(() => {
  const code = AREA_CODES[active.value]
  return code ? `Slide ${active.value + 1} of ${AREA_CODES.length}: ${AREA_LABELS[code]}` : ''
})

// Swipe or drag: the slides follow the pointer, then settle on the nearest one. A mostly
// vertical move is left to the browser, so the page still scrolls.
const viewport = useTemplateRef<HTMLElement>('viewport')
const dragX = ref(0)
const dragging = ref(false)
let pointer: { id: number; x: number; y: number } | undefined
let justDragged = false

function onPointerDown(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
}

function onPointerMove(event: PointerEvent) {
  if (event.pointerId !== pointer?.id) return
  const dx = event.clientX - pointer.x
  if (!dragging.value) {
    if (Math.abs(dx) < 8) return
    if (Math.abs(event.clientY - pointer.y) > Math.abs(dx)) {
      pointer = undefined
      return
    }
    dragging.value = true
    viewport.value?.setPointerCapture(event.pointerId)
    window.getSelection()?.removeAllRanges()
  }
  // Past the first or last slide, the slides move a quarter as far, like a rubber band.
  const pastEnd = (active.value === 0 && dx > 0) || (active.value === LAST && dx < 0)
  dragX.value = pastEnd ? dx / 4 : dx
}

function onPointerEnd(event: PointerEvent) {
  if (event.pointerId !== pointer?.id) return
  pointer = undefined
  if (!dragging.value) return
  const threshold = Math.min(80, (viewport.value?.clientWidth ?? 0) * 0.15)
  if (event.type === 'pointerup') {
    if (dragX.value < -threshold) go(active.value + 1)
    else if (dragX.value > threshold) go(active.value - 1)
  }
  dragging.value = false
  dragX.value = 0
  // The click that ends a drag shouldn't also count as a tap on the peeking slide.
  justDragged = true
  setTimeout(() => (justDragged = false))
}

/** A tap on the peeking slide brings it in. */
function onSlideClick(i: number) {
  if (!justDragged) go(i)
}

const trackStyle = computed(() => ({
  '--dir': direction.value,
  transform: `translate3d(calc(${-active.value} * (var(--slide) + var(--gap)) + ${dragX.value}px), 0, 0)`,
}))
</script>

<template>
  <div
    role="region"
    aria-roledescription="carousel"
    :aria-labelledby="props.labelledby"
    @keydown.arrow-left.prevent="go(active - 1)"
    @keydown.arrow-right.prevent="go(active + 1)"
  >
    <div class="flex items-end gap-4 sm:gap-8">
      <!-- One button per area. The bars fill up to the current slide. -->
      <div class="flex flex-1 gap-2 sm:gap-5">
        <button
          v-for="(code, i) in AREA_CODES"
          :key="code"
          type="button"
          :aria-label="`${AREA_LABELS[code]}, slide ${i + 1} of ${AREA_CODES.length}`"
          :aria-current="active === i ? 'true' : undefined"
          class="group flex min-h-11 max-w-60 flex-1 flex-col justify-end gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-level-2"
          @click="go(i)"
        >
          <span
            class="hidden items-baseline gap-2 text-sm leading-tight font-semibold transition-colors duration-300 sm:flex"
            :class="active === i ? 'text-white' : 'text-white/55 group-hover:text-white/85'"
          >
            <span class="text-level-2 tabular-nums">{{ number(i) }}</span>
            {{ AREA_LABELS[code] }}
          </span>
          <span class="block h-1 overflow-hidden rounded-full bg-white/15">
            <span
              class="block h-full origin-left rounded-full bg-level-2 transition-transform duration-700 ease-glide motion-reduce:transition-none"
              :class="i <= active ? 'scale-x-100' : 'scale-x-0'"
            />
          </span>
        </button>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <button
          v-for="step in [-1, 1] as const"
          :key="step"
          type="button"
          :aria-label="step < 0 ? 'Previous area' : 'Next area'"
          :aria-disabled="active + step < 0 || active + step > LAST"
          class="grid size-12 place-items-center rounded-full border border-white/25 text-white transition-[background-color,opacity] duration-200 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-level-2 aria-disabled:cursor-default aria-disabled:opacity-30 aria-disabled:hover:bg-transparent"
          @click="go(active + step)"
        >
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            class="size-5 fill-none stroke-current stroke-2"
            :class="step < 0 && 'rotate-180'"
          >
            <path d="M4 10h12m-5-5 5 5-5 5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Reaches into the page's left padding and out to the right edge of the screen, so the next
         slide peeks in from the edge. The slides still line up with the heading. -->
    <div
      ref="viewport"
      class="slides-viewport mt-8 -ml-4 touch-pan-y overflow-hidden pl-4 sm:mt-10 sm:-ml-6 sm:pl-6 lg:-ml-8 lg:pl-8"
      :class="dragging ? 'cursor-grabbing select-none' : 'cursor-grab'"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerEnd"
      @pointercancel="onPointerEnd"
      @dragstart.prevent
    >
      <div
        class="flex gap-(--gap) [--gap:1rem] [--slide:88%] sm:[--gap:1.5rem] sm:[--slide:84%] lg:[--slide:88%]"
        :class="
          !dragging && 'transition-transform duration-700 ease-glide motion-reduce:transition-none'
        "
        :style="trackStyle"
      >
        <div
          v-for="(code, i) in AREA_CODES"
          :key="code"
          role="group"
          aria-roledescription="slide"
          :aria-label="`${i + 1} of ${AREA_CODES.length}`"
          :aria-hidden="active !== i"
          class="flex shrink-0 basis-(--slide)"
          @click="onSlideClick(i)"
        >
          <article
            class="slide grid w-full overflow-hidden rounded-[1.5rem] bg-white/[0.05] ring-1 ring-white/12 transition-[opacity,scale] duration-700 ease-glide motion-reduce:transition-none lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]"
            :class="active === i ? 'is-active' : 'scale-[0.96] opacity-45'"
          >
            <div class="order-2 flex flex-col p-6 sm:p-10 lg:order-1 lg:p-12">
              <div class="flex items-start justify-between gap-4">
                <span
                  class="font-display text-7xl leading-[0.8] font-light text-level-2 sm:text-8xl"
                  aria-hidden="true"
                >
                  {{ number(i) }}
                </span>
                <span
                  data-part
                  style="--part: 0"
                  class="rounded-full border border-white/20 px-3 py-1 text-sm whitespace-nowrap text-white/80"
                >
                  {{ ITEMS_PER_AREA }} questions
                </span>
              </div>
              <h3
                data-part
                style="--part: 1"
                class="mt-8 text-3xl leading-tight font-bold text-balance sm:mt-10 sm:text-4xl"
              >
                {{ AREA_LABELS[code] }}
              </h3>
              <p
                data-part
                style="--part: 2"
                class="mt-3 max-w-xl text-lg leading-relaxed text-white/70"
              >
                {{ AREA_DETAILS[code].summary }}
              </p>
              <ul class="mt-8 grid gap-2.5 lg:mt-auto lg:pt-10">
                <li
                  v-for="(topic, k) in AREA_DETAILS[code].topics"
                  :key="topic"
                  data-part
                  :style="{ '--part': 3 + k }"
                  class="flex min-h-12 items-center gap-3 rounded-control bg-white/[0.06] px-4 py-2.5 text-white/90"
                >
                  <span class="size-1.5 shrink-0 rounded-full bg-marigold" aria-hidden="true" />
                  {{ topic }}
                </li>
              </ul>
            </div>

            <div
              class="order-1 grid place-items-center border-b border-white/10 bg-white/[0.03] px-5 py-8 sm:px-10 sm:py-10 lg:order-2 lg:border-b-0 lg:border-l lg:px-8"
            >
              <AreaScene :area="code" :playing="active === i" />
            </div>
          </article>
        </div>
      </div>
    </div>

    <p class="sr-only" aria-live="polite">{{ announcement }}</p>
  </div>
</template>

<style scoped>
/* The right side: margin out to the screen's edge, padding back in by the same amount. The
   peeking slide fades out toward the edge. */
.slides-viewport {
  margin-right: calc(50% - 50vw);
  padding-right: calc(50vw - 50%);
  mask-image: linear-gradient(90deg, #000 calc(100% - 4rem), transparent);
}

/* The current slide's text comes in one piece after another, from the side it's moving to. */
@media (prefers-reduced-motion: no-preference) {
  [data-part] {
    transition:
      opacity 0.6s var(--ease-glide),
      translate 0.6s var(--ease-glide);
    transition-delay: calc(var(--part) * 70ms + 180ms);
  }

  .slide:not(.is-active) [data-part] {
    opacity: 0;
    translate: calc(var(--dir) * 3rem) 0;
    transition-delay: 0ms;
  }
}
</style>
