import type { InferResponseType } from 'hono/client'
import { ref } from 'vue'
import { api, ApiRequestError, call, messageOf } from '../lib/api'

export type Lesson = InferResponseType<(typeof api.lessons)[':slug']['$get'], 200>

// The API's answer for a slug with no published lesson (404), or one that can't be a slug (400).
const NOT_FOUND_CODES = new Set(['not_found', 'validation_failed'])

/**
 * One published lesson by its slug (LES-02), signed in or not (LES-03). `notFound` is set when
 * there's no such lesson or it isn't published yet. Other failures set `error` in words for
 * students. Only the latest `load` counts, so going from one lesson to the next quickly never
 * shows the older one.
 */
export function useLesson() {
  const lesson = ref<Lesson | null>(null)
  const notFound = ref(false)
  const error = ref<string | null>(null)
  let latest = 0

  async function load(slug: string) {
    const request = ++latest
    lesson.value = null
    notFound.value = false
    error.value = null
    try {
      const found = await call(api.lessons[':slug'].$get({ param: { slug } }))
      if (request === latest) lesson.value = found
    } catch (err) {
      if (request !== latest) return
      if (err instanceof ApiRequestError && NOT_FOUND_CODES.has(err.code)) notFound.value = true
      else error.value = messageOf(err)
    }
  }

  return { lesson, notFound, error, load }
}
