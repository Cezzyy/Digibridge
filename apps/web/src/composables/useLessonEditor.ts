import type { LessonInput } from '@digibridge/shared'
import type { InferResponseType } from 'hono/client'
import { ref } from 'vue'
import { api, ApiRequestError, call, messageOf } from '../lib/api'

export type AdminLesson = InferResponseType<(typeof api.admin.lessons)[':id']['$get'], 200>

/**
 * One lesson in the lessons editor (CMS-04): loads it by ID, and saves it as a new lesson or as
 * changes to this one. Admin only. `notFound` is set when the lesson isn't there (deleted, or a
 * bad link). Only the latest `load` counts.
 */
export function useLessonEditor() {
  const lesson = ref<AdminLesson | null>(null)
  const notFound = ref(false)
  const loadError = ref<string | null>(null)
  const saving = ref(false)
  const saveError = ref<string | null>(null)
  let latest = 0

  async function load(id: string) {
    const request = ++latest
    lesson.value = null
    notFound.value = false
    loadError.value = null
    try {
      const found = await call(api.admin.lessons[':id'].$get({ param: { id } }))
      if (request === latest) lesson.value = found
    } catch (err) {
      if (request !== latest) return
      if (err instanceof ApiRequestError && err.code === 'not_found') notFound.value = true
      else loadError.value = messageOf(err)
    }
  }

  /** Saves `input` as a new lesson, or over the one `id` names. Resolves the saved lesson, or null with `saveError` set. */
  async function save(input: LessonInput, id?: string) {
    saving.value = true
    saveError.value = null
    try {
      const saved = id
        ? await call(api.admin.lessons[':id'].$patch({ param: { id }, json: input }))
        : await call(api.admin.lessons.$post({ json: input }))
      lesson.value = saved
      return saved
    } catch (err) {
      saveError.value = messageOf(err)
      return null
    } finally {
      saving.value = false
    }
  }

  return { lesson, notFound, loadError, load, saving, saveError, save }
}
