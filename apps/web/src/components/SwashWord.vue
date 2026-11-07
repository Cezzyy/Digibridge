<!-- A heading word in evergreen with a marigold brush stroke under it, drawn in as the page opens.
     To keep punctuation on the same line, wrap both in `whitespace-nowrap` with no space between. -->
<template>
  <span class="relative isolate inline-block text-evergreen"
    ><slot /><svg
      viewBox="0 0 200 16"
      preserveAspectRatio="none"
      aria-hidden="true"
      class="absolute -bottom-[0.06em] left-[-3%] -z-10 h-[0.3em] w-[106%]"
    >
      <path
        d="M4 11 C 50 4, 140 2, 196 8"
        pathLength="1"
        class="swash fill-none stroke-marigold"
        stroke-width="7"
        stroke-linecap="round"
      /></svg
  ></span>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .swash {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: draw 0.9s cubic-bezier(0.65, 0, 0.35, 1) 0.7s forwards;
  }
}

@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}
</style>
