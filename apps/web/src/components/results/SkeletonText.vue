<script setup lang="ts">
// A loading placeholder for a line of text. Put it inside the element the text will fill, with
// that element's own type classes, so the line keeps the text's height: it's sized in `em` and
// sits in the line like a word. Set the width with a class (`w-40`, `w-[6em]`). `tone` matches
// what it sits on: white (the default), the page's mist background, a mist-soft box, a
// marigold-soft box or the green panel.
const props = withDefaults(
  defineProps<{ tone?: 'mist' | 'page' | 'soft' | 'marigold' | 'rail' }>(),
  { tone: 'mist' },
)
const TONE = {
  mist: 'bg-skeleton',
  page: 'bg-line-strong/20',
  soft: 'bg-line/70',
  marigold: 'bg-marigold/25',
  rail: 'bg-white/20',
} as const
</script>

<template>
  <span
    aria-hidden="true"
    class="inline-block h-[0.75em] max-w-full rounded-full align-middle motion-safe:animate-skeleton"
    :class="TONE[props.tone]"
  />
</template>
