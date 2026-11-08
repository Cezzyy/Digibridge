<script setup lang="ts">
// The frame of every page before the assessment, across the whole screen. Desktops get a green
// panel on the left (`#rail`: the page's heading, where the student is and side notes), which
// stays put while the content on the right scrolls. Phones and tablets stack the panel above the
// content as a header band. `#actions` is a bar under the content that sticks to the bottom of
// the screen from tablets up, so the page's buttons are always in reach. `stickOnPhones` makes it
// stick on phones too, for pages whose bar is short (home); the notice's and the profile's bars
// stack two buttons on phones and would cover too much of the screen.
defineProps<{ stickOnPhones?: boolean }>()

// The bridge drawn faintly at the foot of the panel (it stays with the panel as the page scrolls): two towers, the cable and its hangers.
const W = 480
const DECK = 200
const TOWERS = [120, 360] as const
const cableY = (x: number) => {
  const [left, right] = TOWERS
  const curve = (t: number, y0: number, yc: number, y1: number) =>
    (1 - t) ** 2 * y0 + 2 * (1 - t) * t * yc + t ** 2 * y1
  if (x < left) return curve(x / left, 150, 110, 40)
  if (x > right) return curve((W - x) / (W - right), 150, 110, 40)
  return curve((x - left) / (right - left), 40, 220, 40)
}
const cable = `M0,150 Q60,110 120,40 Q240,220 360,40 Q420,110 480,150`
const hangers = Array.from({ length: W / 20 - 1 }, (_, i) => (i + 1) * 20)
  .filter((x) => !TOWERS.includes(x as (typeof TOWERS)[number]))
  .map((x) => ({ x, y: cableY(x) }))
</script>

<template>
  <main
    class="min-h-[calc(100svh-var(--spacing-header))] lg:grid lg:grid-cols-[24rem_minmax(0,1fr)] xl:grid-cols-[28rem_minmax(0,1fr)] 2xl:grid-cols-[26rem_minmax(0,1fr)] 3xl:grid-cols-[30rem_minmax(0,1fr)]"
  >
    <header class="bg-linear-to-b from-evergreen to-evergreen-hover text-white">
      <div
        class="relative isolate flex flex-col px-4 py-7 sm:px-8 sm:py-9 lg:sticky lg:top-header lg:h-[calc(100svh-var(--spacing-header))] lg:overflow-y-auto lg:px-10 lg:py-12 xl:px-12 2xl:py-8 lg:short:py-8 2xl:snug:py-6"
      >
        <slot name="rail" />

        <svg
          :viewBox="`0 0 ${W} ${DECK}`"
          aria-hidden="true"
          class="pointer-events-none absolute inset-x-0 bottom-0 -z-10 hidden w-full opacity-10 lg:block"
        >
          <g fill="none" stroke="currentColor" stroke-linecap="round">
            <line
              v-for="h in hangers"
              :key="h.x"
              :x1="h.x"
              :x2="h.x"
              :y1="h.y"
              :y2="DECK - 16"
              stroke-width="1"
            />
            <line
              v-for="x in TOWERS"
              :key="x"
              :x1="x"
              :x2="x"
              y1="28"
              :y2="DECK"
              stroke-width="6"
            />
            <path :d="cable" stroke-width="2.5" />
            <line x1="0" :x2="W" :y1="DECK - 16" :y2="DECK - 16" stroke-width="4" />
          </g>
        </svg>
      </div>
    </header>

    <div class="flex min-w-0 flex-col">
      <div
        class="flex-1 px-4 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-12 xl:px-14 2xl:px-12 2xl:py-8 2xl:snug:py-6 3xl:px-16"
      >
        <slot />
      </div>
      <div
        v-if="$slots.actions"
        :class="stickOnPhones && 'sticky bottom-0 z-10'"
        class="border-t border-line bg-surface/95 px-4 py-4 backdrop-blur sm:sticky sm:bottom-0 sm:z-10 sm:px-8 lg:px-10 xl:px-14 2xl:px-12 2xl:snug:py-3 3xl:px-16"
      >
        <slot name="actions" />
      </div>
    </div>
  </main>
</template>
