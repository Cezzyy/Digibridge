import type { QuestionInput } from '@digibridge/shared'
import type { InferResponseType } from 'hono/client'
import { ref } from 'vue'
import { api, ApiRequestError, call, messageOf } from '../lib/api'

export type AdminQuestion = InferResponseType<(typeof api.admin.questions)[':id']['$get'], 200>

/**
 * One question in the questions editor (CMS-01 to CMS-03): loads it by ID, and saves it as a new
 * question or as changes to this one. Admin only. `notFound` is set when the question isn't there
 * (deleted, or a bad link). Only the latest `load` counts.
 */
export function useQuestionEditor() {
  const question = ref<AdminQuestion | null>(null)
  const notFound = ref(false)
  const loadError = ref<string | null>(null)
  const saving = ref(false)
  const saveError = ref<string | null>(null)
  let latest = 0

  async function load(id: string) {
    const request = ++latest
    question.value = null
    notFound.value = false
    loadError.value = null
    try {
      const found = await call(api.admin.questions[':id'].$get({ param: { id } }))
      if (request === latest) question.value = found
    } catch (err) {
      if (request !== latest) return
      if (err instanceof ApiRequestError && err.code === 'not_found') notFound.value = true
      else loadError.value = messageOf(err)
    }
  }

  /**
   * Saves `input` as a new question, or over the one `id` names. Resolves the saved question, or
   * null with `saveError` set: a 409 means students have seen it since the page loaded, so its
   * area, difficulty and right answer are locked now.
   */
  async function save(input: QuestionInput, id?: string) {
    saving.value = true
    saveError.value = null
    try {
      const saved = id
        ? await call(api.admin.questions[':id'].$patch({ param: { id }, json: input }))
        : await call(api.admin.questions.$post({ json: input }))
      question.value = saved
      return saved
    } catch (err) {
      saveError.value = messageOf(err)
      // Marked in place, not replaced: the form starts again from a new question, and would
      // drop what the admin typed. It locks its fixed fields from `shown` alone.
      if (id && question.value && err instanceof ApiRequestError && err.code === 'conflict') {
        question.value.shown = true
      }
      return null
    } finally {
      saving.value = false
    }
  }

  return { question, notFound, loadError, load, saving, saveError, save }
}
