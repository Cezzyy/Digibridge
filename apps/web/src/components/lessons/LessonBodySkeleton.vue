<script setup lang="ts">
import SkeletonText from '../results/SkeletonText.vue'

// Shaped like the lesson's contents (LessonToc) and the start of its body (LessonBody) while
// the lesson loads: an opening paragraph, then two numbered parts. Each line uses the real
// text's type classes, so the page doesn't jump when the lesson comes in.
const TOC_WIDTHS = ['w-4/5', 'w-3/5', 'w-11/12', 'w-2/3', 'w-1/2']
const PARTS = [
  { title: 'w-4/5', lines: ['w-full', 'w-full', 'w-11/12', 'w-3/5'] },
  { title: 'w-3/5', lines: ['w-full', 'w-11/12', 'w-full', 'w-2/5'] },
]
</script>

<template>
  <div
    aria-hidden="true"
    class="mx-auto grid max-w-7xl gap-12 px-4 py-12 sm:px-8 sm:py-16 lg:grid-cols-[13rem_minmax(0,1fr)] lg:px-10 lg:py-20 xl:grid-cols-[16rem_minmax(0,1fr)] xl:gap-20"
  >
    <div class="hidden lg:block">
      <p class="text-sm font-semibold text-quiet">In this lesson</p>
      <ol class="mt-4">
        <li
          v-for="(width, i) in TOC_WIDTHS"
          :key="i"
          class="flex gap-3 border-l-2 border-line py-2 pr-2 pl-4 leading-snug"
        >
          <span class="w-5 shrink-0 text-sm"><SkeletonText class="w-full" /></span>
          <SkeletonText :class="width" />
        </li>
      </ol>
    </div>

    <div class="min-w-0 max-w-[44rem]">
      <p class="mb-14 text-lg leading-[1.7]">
        <SkeletonText class="w-full" />
        <br />
        <SkeletonText class="w-full" />
        <br />
        <SkeletonText class="w-3/4" />
      </p>

      <div
        v-for="(part, i) in PARTS"
        :key="i"
        class="border-t border-line pt-12 not-first:mt-14 first:border-t-0 first:pt-0"
      >
        <p class="font-semibold"><SkeletonText class="w-[5em]" /></p>
        <p
          class="mt-3 text-[clamp(1.75rem,1.45rem+1vw,2.25rem)] leading-[1.1] font-bold tracking-[-0.02em]"
        >
          <SkeletonText :class="part.title" />
        </p>
        <p class="mt-6 text-lg leading-[1.7]">
          <template v-for="(width, j) in part.lines" :key="j">
            <br v-if="j > 0" />
            <SkeletonText :class="width" />
          </template>
        </p>
      </div>
    </div>
  </div>
</template>
