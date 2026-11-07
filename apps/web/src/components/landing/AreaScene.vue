<script setup lang="ts">
import type { AreaCode } from '@digibridge/shared'

// The little picture on each "What it checks" slide. Each one plays a short animation while its
// slide is the current one, and shows its last frame otherwise. Decorative only.

defineProps<{ area: AreaCode; playing: boolean }>()

const RESULTS = [
  { mark: 'gov', title: 'Class suspension notice', site: 'official .gov website', official: true },
  { mark: '24/7', title: 'NO CLASSES TOMORROW!!', site: 'metro-updates247.site', official: false },
  { mark: 'News', title: 'Weather bulletin, 5 AM', site: 'national news site', official: true },
]

const DOC_LINES = [
  { width: '94%' },
  { width: '80%', who: 'JL', tone: 'bg-level-2 text-ink' },
  { width: '88%' },
  { width: '56%', who: 'You', tone: 'bg-marigold text-ink' },
]

const PEOPLE = [
  { initials: 'JL', tone: 'bg-level-2' },
  { initials: 'AN', tone: 'bg-marigold-soft' },
  { initials: 'You', tone: 'bg-marigold' },
]

const PASSWORD_LENGTH = 12
</script>

<template>
  <div
    aria-hidden="true"
    class="scene w-full max-w-sm select-none"
    :class="playing && 'is-playing'"
  >
    <!-- Information: a search, then the results with their sources checked. -->
    <div
      v-if="area === 'info_literacy'"
      class="rounded-2xl bg-surface p-4 text-ink shadow-[0_30px_60px_-30px_rgb(0_0_0/0.6)]"
    >
      <div class="flex items-center gap-2 rounded-full bg-mist-soft px-3.5 py-2.5 ring-1 ring-line">
        <svg viewBox="0 0 20 20" class="size-4 shrink-0 fill-none stroke-quiet stroke-2">
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="M13 13l4 4" stroke-linecap="round" />
        </svg>
        <span class="typed min-w-0 truncate text-sm">is there no class tomorrow?</span>
        <span class="caret h-4 w-px shrink-0 bg-ink" />
      </div>
      <ul class="mt-3 space-y-2">
        <li
          v-for="(r, k) in RESULTS"
          :key="r.title"
          class="result flex items-center gap-3 rounded-xl border border-line p-2.5"
          :style="{ '--k': k }"
        >
          <span
            class="grid size-9 shrink-0 place-items-center rounded-lg text-[0.625rem] font-bold"
            :class="r.official ? 'bg-evergreen-soft text-evergreen' : 'bg-mist text-quiet'"
          >
            {{ r.mark }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm leading-tight font-semibold">{{ r.title }}</span>
            <span class="block truncate text-xs text-quiet">{{ r.site }}</span>
          </span>
          <span
            class="badge inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-bold"
            :class="r.official ? 'bg-evergreen text-white' : 'bg-marigold-soft text-marigold-text'"
          >
            <svg
              v-if="r.official"
              viewBox="0 0 16 16"
              class="size-3 fill-none stroke-current stroke-[2.5]"
            >
              <path d="M3.5 8.5l3 3 6-7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            {{ r.official ? 'Trusted' : 'No source' }}
          </span>
        </li>
      </ul>
    </div>

    <!-- Communication: three people writing one shared report. -->
    <div
      v-else-if="area === 'communication'"
      class="rounded-2xl bg-surface p-4 text-ink shadow-[0_30px_60px_-30px_rgb(0_0_0/0.6)]"
    >
      <div class="flex items-center justify-between gap-3">
        <p class="flex items-center gap-2 text-sm font-semibold">
          <svg viewBox="0 0 24 24" class="size-5 fill-none stroke-evergreen stroke-2">
            <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
            <path d="M14 3v5h5M9 13h6M9 17h4" stroke-linecap="round" />
          </svg>
          Group report
        </p>
        <span class="flex -space-x-1.5">
          <span
            v-for="(p, k) in PEOPLE"
            :key="p.initials"
            class="person grid size-7 place-items-center rounded-full text-[0.5625rem] font-bold ring-2 ring-surface"
            :class="p.tone"
            :style="{ '--k': k }"
          >
            {{ p.initials }}
          </span>
        </span>
      </div>
      <p class="mt-4 h-3 w-2/5 rounded-full bg-ink/80" />
      <div class="mt-3 space-y-2.5">
        <div
          v-for="(line, k) in DOC_LINES"
          :key="k"
          class="line relative h-2 rounded-full"
          :class="line.who ? 'bg-level-1' : 'bg-track'"
          :style="{ width: line.width, '--k': k }"
        >
          <span
            v-if="line.who"
            class="absolute top-1/2 -right-0.5 h-4 w-0.5 -translate-y-1/2 rounded-full bg-ink"
          />
          <span
            v-if="line.who"
            class="absolute -top-5 -right-0.5 rounded-sm rounded-bl-none px-1 text-[0.5625rem] leading-4 font-bold"
            :class="line.tone"
          >
            {{ line.who }}
          </span>
        </div>
      </div>
      <div class="comment mt-5 flex items-start gap-2 rounded-xl bg-marigold-soft p-2.5">
        <span
          class="grid size-6 shrink-0 place-items-center rounded-full bg-surface text-[0.5625rem] font-bold"
        >
          AN
        </span>
        <p class="text-xs leading-snug">
          I’ll take the summary. Leave a comment if you change my part!
        </p>
      </div>
    </div>

    <!-- Safety: a strong password, two-step sign-in, and a scam link caught. -->
    <div
      v-else
      class="rounded-2xl bg-surface p-4 text-ink shadow-[0_30px_60px_-30px_rgb(0_0_0/0.6)]"
    >
      <p class="text-xs font-semibold text-quiet">New password</p>
      <div
        class="mt-1.5 flex h-11 items-center gap-1.5 rounded-control border border-line-strong px-3"
      >
        <span
          v-for="k in PASSWORD_LENGTH"
          :key="k"
          class="dot size-2 rounded-full bg-ink"
          :style="{ '--k': k }"
        />
      </div>
      <div class="mt-2 flex items-center gap-2">
        <span class="flex flex-1 gap-1">
          <span
            v-for="k in 4"
            :key="k"
            class="meter h-1.5 flex-1 origin-left rounded-full bg-evergreen"
            :style="{ '--k': k }"
          />
        </span>
        <span class="strong text-xs font-bold text-evergreen">Strong</span>
      </div>

      <div class="mt-4 flex items-center justify-between gap-3 rounded-xl bg-mist-soft px-3 py-2.5">
        <span class="text-sm font-semibold">Two-step sign-in</span>
        <span class="switch relative h-6 w-10 shrink-0 rounded-full bg-evergreen">
          <span
            class="knob absolute top-0.5 left-0.5 size-5 translate-x-4 rounded-full bg-white shadow-sm"
          />
        </span>
      </div>

      <div
        class="alert mt-3 flex items-center gap-3 rounded-xl border border-marigold bg-marigold-soft px-3 py-2.5"
      >
        <svg viewBox="0 0 24 24" class="size-7 shrink-0 fill-none stroke-marigold-text stroke-2">
          <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" stroke-linejoin="round" />
          <path d="M12 8v4.5M12 16v.01" stroke-linecap="round" />
        </svg>
        <span>
          <span class="block text-sm leading-tight font-bold">That link looks like a scam</span>
          <span class="block text-xs text-quiet">You didn’t tap it. Good call.</span>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Every animation runs from a "from" frame to the element's normal look, so a scene that isn't
   playing simply shows its finished state. */
@media (prefers-reduced-motion: no-preference) {
  /* Information */
  .is-playing .typed {
    animation: type 1.2s steps(27, end) 0.35s both;
  }

  .is-playing .caret {
    animation: blink 0.9s step-end infinite;
  }

  .is-playing .result {
    animation: rise-in 0.6s var(--ease-glide) both;
    animation-delay: calc(1.6s + var(--k) * 140ms);
  }

  .is-playing .badge {
    animation: pop 0.45s var(--ease-glide) both;
    animation-delay: calc(2.3s + var(--k) * 160ms);
  }

  /* Communication */
  .is-playing .person {
    animation: pop 0.45s var(--ease-glide) both;
    animation-delay: calc(0.3s + var(--k) * 120ms);
  }

  .is-playing .line {
    animation: write 0.9s var(--ease-glide) both;
    animation-delay: calc(0.6s + var(--k) * 260ms);
  }

  .is-playing .comment {
    animation: rise-in 0.6s var(--ease-glide) 1.9s both;
  }

  /* Safety */
  .is-playing .dot {
    animation: pop 0.25s var(--ease-glide) both;
    animation-delay: calc(0.3s + var(--k) * 70ms);
  }

  .is-playing .meter {
    animation: grow-x 0.4s var(--ease-glide) both;
    animation-delay: calc(0.5s + var(--k) * 180ms);
  }

  .is-playing .strong {
    animation: fade 0.4s ease-out 1.3s both;
  }

  .is-playing .switch {
    animation: switch-on 0.3s ease-out 1.7s both;
  }

  .is-playing .knob {
    animation: knob-on 0.35s var(--ease-glide) 1.7s both;
  }

  .is-playing .alert {
    animation:
      slide-in 0.6s var(--ease-glide) 2.3s both,
      nudge 0.5s ease-in-out 2.9s;
  }
}

@keyframes type {
  from {
    clip-path: inset(0 100% 0 0);
  }
  to {
    clip-path: inset(0);
  }
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

@keyframes rise-in {
  from {
    opacity: 0;
    translate: 0 0.75rem;
  }
}

@keyframes pop {
  from {
    opacity: 0;
    scale: 0.4;
  }
}

@keyframes write {
  from {
    width: 0;
  }
}

@keyframes grow-x {
  from {
    scale: 0 1;
  }
}

@keyframes fade {
  from {
    opacity: 0;
  }
}

@keyframes switch-on {
  from {
    background-color: var(--color-line-strong);
  }
}

@keyframes knob-on {
  from {
    translate: 0 0;
  }
}

@keyframes slide-in {
  from {
    opacity: 0;
    translate: 2rem 0;
  }
}

@keyframes nudge {
  25% {
    rotate: -1.5deg;
  }
  75% {
    rotate: 1.5deg;
  }
}
</style>
