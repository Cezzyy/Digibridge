<script setup lang="ts">
import BrandMark from '../components/BrandMark.vue'
import GoogleSignInButton from '../components/GoogleSignInButton.vue'
import BridgeArt from '../components/landing/BridgeArt.vue'
import SectionEyebrow from '../components/landing/SectionEyebrow.vue'
import { STEPS } from '../components/landing/steps'
import SiteHeader from '../components/SiteHeader.vue'
import SwashWord from '../components/SwashWord.vue'
import { useSessionStore } from '../stores/session'

// Sign in and sign up are the same step: Google sign-in, and the first one makes the account
// (AUTH-01, AUTH-02). Signed-in users never get here; the `guest` guard sends them home.
// Same look as the landing page, which it draws its own top bar for (`hideHeader` in router.ts).
// It fits on one screen: phones show only the heading and the card, the intro text hides on short
// screens, and the bridge shows only on tall desktop screens. `main` scrolls only as a last resort
// (a phone held sideways).
const session = useSessionStore()
const LAST = STEPS.length - 1
</script>

<template>
  <div class="flex h-svh flex-col overflow-x-clip">
    <SiteHeader>
      <RouterLink
        :to="{ name: 'landing' }"
        class="group inline-flex min-h-11 items-center gap-1.5 rounded-control px-3 font-semibold text-quiet transition-colors hover:text-ink"
      >
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          class="size-5 fill-none stroke-current stroke-2 transition-transform group-hover:-translate-x-0.5"
        >
          <path d="M16 10H4m5-5-5 5 5 5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        Back
      </RouterLink>
    </SiteHeader>

    <!-- Phones stack the heading and the card; tablets put the heading across the top and the
         steps beside the card; desktops put the card beside everything. -->
    <main class="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div
        class="sign-in-grid mx-auto my-auto grid w-full max-w-7xl gap-y-6 px-4 py-6 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] md:gap-x-10 md:gap-y-8 md:py-8 lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:px-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] xl:gap-x-20 short:gap-y-5 short:py-4"
      >
        <div class="[grid-area:intro]">
          <SectionEyebrow class="text-evergreen">Sign in or sign up</SectionEyebrow>
          <h1
            class="mt-3 text-[clamp(2.25rem,1.2rem+3vw,4rem)] leading-[0.95] font-extrabold tracking-[-0.02em] text-balance motion-safe:animate-rise"
          >
            Let’s find your
            <span class="whitespace-nowrap"><SwashWord>level</SwashWord>.</span>
          </h1>
          <p
            class="mt-4 hidden max-w-[34rem] text-lg leading-relaxed text-quiet md:block md:short:hidden motion-safe:animate-rise motion-safe:[animation-delay:160ms]"
          >
            Sign in with your Google account to take the DigiBridge assessment. It’s the same button
            whether it’s your first time or you’re coming back.
          </p>
        </div>

        <section
          aria-labelledby="sign-in-title"
          class="w-full max-w-lg self-start overflow-hidden rounded-[1.25rem] border border-line bg-surface shadow-[0_1px_0_var(--color-line),0_30px_60px_-30px_rgb(18_36_28/0.35)] [grid-area:card] motion-safe:animate-rise motion-safe:[animation-delay:240ms] md:max-w-none lg:self-center"
        >
          <div class="p-5 sm:p-7">
            <span
              class="mb-5 hidden size-12 place-items-center rounded-xl bg-evergreen-soft sm:grid short:hidden"
            >
              <BrandMark class="size-8" />
            </span>
            <h2
              id="sign-in-title"
              class="text-2xl leading-tight font-bold tracking-[-0.02em] sm:text-3xl"
            >
              Welcome to DigiBridge
            </h2>
            <p class="mt-2 leading-relaxed text-quiet">
              Use your Google account. If this is your first time, we’ll make your DigiBridge
              account for you.
            </p>

            <p
              v-if="session.error"
              role="alert"
              class="mt-5 rounded-control bg-error-soft px-4 py-3 text-error"
            >
              {{ session.error }}
            </p>

            <GoogleSignInButton class="mt-6 w-full" />

            <ul class="mt-6 space-y-3 border-t border-line pt-5 text-sm leading-relaxed text-quiet">
              <li class="flex gap-3">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  class="mt-px size-5 shrink-0 fill-none stroke-evergreen stroke-2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                We only get your name, email and profile photo from Google, never your password.
              </li>
              <li class="flex gap-3">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  class="mt-px size-5 shrink-0 fill-none stroke-evergreen stroke-2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
                <span>
                  Only the DigiBridge team can see your answers.
                  <RouterLink
                    :to="{ name: 'privacy' }"
                    class="font-semibold whitespace-nowrap text-evergreen underline decoration-evergreen/40 underline-offset-2 hover:decoration-evergreen"
                  >
                    Read the privacy notice
                  </RouterLink>
                </span>
              </li>
            </ul>
          </div>
        </section>

        <!-- What comes after signing in, with this step marked. -->
        <section
          aria-labelledby="next-title"
          class="hidden [grid-area:steps] md:block motion-safe:animate-rise motion-safe:[animation-delay:320ms]"
        >
          <h2 id="next-title" class="text-xl font-bold">What happens next</h2>
          <ol class="mt-4">
            <li
              v-for="(step, i) in STEPS"
              :key="step.title"
              :aria-current="i === 0 ? 'step' : undefined"
              class="relative flex gap-4 pb-4 last:pb-0 short:pb-3"
            >
              <span
                v-if="i < LAST"
                aria-hidden="true"
                class="absolute top-10 bottom-1 left-4 w-0.5 -translate-x-1/2 rounded-full"
                :class="i === 0 ? 'bg-evergreen/40' : 'bg-evergreen/15'"
              />
              <span
                class="relative grid size-8 shrink-0 place-items-center rounded-full border-2 font-display text-sm font-bold"
                :class="
                  i === 0
                    ? 'border-evergreen bg-evergreen text-white'
                    : i === LAST
                      ? 'border-marigold bg-marigold-soft text-ink'
                      : 'border-evergreen/30 bg-mist text-evergreen'
                "
              >
                <span
                  v-if="i === 0"
                  aria-hidden="true"
                  class="pulse absolute -inset-0.5 rounded-full border-2 border-evergreen"
                />
                {{ i + 1 }}
              </span>
              <div class="min-w-0 pt-1">
                <p class="flex flex-wrap items-center gap-x-2 gap-y-1 leading-snug font-semibold">
                  {{ step.title }}
                  <span
                    v-if="i === 0"
                    class="rounded-full bg-marigold-soft px-2 py-0.5 text-xs font-semibold text-marigold-text"
                  >
                    You’re here
                  </span>
                </p>
                <p class="mt-0.5 text-sm leading-relaxed text-quiet">{{ step.body }}</p>
              </div>
            </li>
          </ol>
        </section>
      </div>
    </main>

    <BridgeArt class="hidden shrink-0 lg:tall:block" />
  </div>
</template>

<style scoped>
.sign-in-grid {
  grid-template-areas: 'intro' 'card' 'steps';
}

@media (width >= 48rem) {
  .sign-in-grid {
    grid-template-areas: 'intro intro' 'steps card';
  }
}

@media (width >= 64rem) {
  .sign-in-grid {
    grid-template-areas: 'intro card' 'steps card';
  }
}

/* The current step's ring breathes, like the landing page's walkthrough. */
@media (prefers-reduced-motion: no-preference) {
  .pulse {
    animation: pulse 2.4s ease-out infinite;
  }
}

@keyframes pulse {
  from {
    opacity: 0.6;
    scale: 1;
  }
  to {
    opacity: 0;
    scale: 1.5;
  }
}
</style>
