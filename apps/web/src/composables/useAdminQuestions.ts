import type { InferResponseType } from 'hono/client'
import { ref } from 'vue'
import { api, call, messageOf } from '../lib/api'

export type AdminQuestionRow = InferResponseType<
  typeof api.admin.questions.$get,
  200
>['questions'][number]

/**
 * Every question for the questions page, inactive ones included (CMS-01), with deleting one no
 * attempt has shown (CMS-02). Admin only. A delete takes the row out of the list, so no reload
 * is needed.
 */
export function useAdminQuestions() {
  const questions = ref<AdminQuestionRow[] | null>(null)
  const loadError = ref<string | null>(null)
  /** The question being deleted, so only its button shows it's busy. */
  const deletingId = ref<string | null>(null)
  const deleteError = ref<string | null>(null)

  async function load() {
    loadError.value = null
    try {
      questions.value = (await call(api.admin.questions.$get())).questions
    } catch (err) {
      loadError.value = messageOf(err)
    }
  }

  async function remove(id: string) {
    deletingId.value = id
    deleteError.value = null
    try {
      await call(api.admin.questions[':id'].$delete({ param: { id } }))
      questions.value = (questions.value ?? []).filter((row) => row.id !== id)
      return true
    } catch (err) {
      deleteError.value = messageOf(err)
      return false
    } finally {
      deletingId.value = null
    }
  }

  return { questions, loadError, load, deletingId, deleteError, remove }
}
