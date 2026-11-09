import type { AreaCode, LessonTier } from '@digibridge/shared'
import type { InferResponseType } from 'hono/client'
import { ref } from 'vue'
import { api, call, messageOf } from '../lib/api'

export type LessonSummary = InferResponseType<typeof api.lessons.$get, 200>['lessons'][number]

/**
 * The published lessons, for the library and a lesson's "in this area" list (LES-01). Public,
 * so it works signed out (LES-03). A failed load sets `error` in words for students. Only the
 * latest `load` counts, like useLesson.
 */
export function useLessons() {
  const lessons = ref<LessonSummary[] | null>(null)
  const error = ref<string | null>(null)
  let latest = 0

  async function load(query: { area?: AreaCode; tier?: LessonTier } = {}) {
    const request = ++latest
    lessons.value = null
    error.value = null
    try {
      const found = (await call(api.lessons.$get({ query }))).lessons
      if (request === latest) lessons.value = found
    } catch (err) {
      if (request === latest) error.value = messageOf(err)
    }
  }

  return { lessons, error, load }
}
