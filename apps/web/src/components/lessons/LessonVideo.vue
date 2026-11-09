<script setup lang="ts">
import { computed } from 'vue'

// A lesson's video (LES-02). YouTube links play in the page, through youtube-nocookie.com so
// YouTube sets no cookies until the student presses play. Any other link opens in a new tab.
const props = defineProps<{ url: string; title: string }>()

// The 11-character video ID from youtube.com/watch?v=, youtu.be/, /embed/ or /shorts/ links.
function youTubeId(url: string) {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const host = parsed.hostname.replace(/^(www|m)\./, '')
  const id =
    host === 'youtu.be'
      ? parsed.pathname.slice(1)
      : host === 'youtube.com' || host === 'youtube-nocookie.com'
        ? parsed.pathname === '/watch'
          ? parsed.searchParams.get('v')
          : parsed.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1]
        : null
  return id && /^[\w-]{11}$/.test(id) ? id : null
}

const embed = computed(() => {
  const id = youTubeId(props.url)
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null
})
</script>

<template>
  <figure v-if="embed" class="overflow-hidden rounded-card border border-line bg-ink">
    <iframe
      :src="embed"
      :title="`Video: ${title}`"
      class="aspect-video w-full"
      loading="lazy"
      referrerpolicy="strict-origin-when-cross-origin"
      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowfullscreen
    />
  </figure>
  <a
    v-else
    :href="url"
    target="_blank"
    rel="noopener noreferrer"
    class="flex min-h-12 items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 font-semibold text-evergreen hover:border-evergreen hover:bg-evergreen-soft"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true" class="size-6 shrink-0 fill-marigold">
      <path d="M8 5.5v13l10.5-6.5z" />
    </svg>
    Watch the video for this lesson
    <span class="sr-only">(opens in a new tab)</span>
  </a>
</template>
