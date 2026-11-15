import type { InferResponseType } from 'hono/client'
import { ref } from 'vue'
import { api, call, messageOf } from '../lib/api'

export type AdminQuestionRow = InferResponseType<
  typeof api.admin.questions.$get,
  200
>['questions'][number]

/**
 * Every question for the questions page, inactive ones included (CMS-01), with making one active
 * or inactive, and deleting one no attempt has shown (CMS-02). Admin only. Both change the row in
 * the list, so no reload is needed.
 */
export function useAdminQuestions() {
  const questions = ref<AdminQuestionRow[] | null>(null)
  const loadError = ref<string | null>(null)
  /** The question being deleted, so only its button shows it's busy. */
  const deletingId = ref<string | null>(null)
  const deleteError = ref<string | null>(null)
  /** The question being made active or inactive. */
  const togglingId = ref<string | null>(null)
  const toggleError = ref<string | null>(null)

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

  async function setActive(id: string, isActive: boolean) {
    togglingId.value = id
    toggleError.value = null
    try {
      const saved = await call(
        api.admin.questions[':id'].$patch({ param: { id }, json: { isActive } }),
      )
      questions.value = (questions.value ?? []).map((row) =>
        row.id === id ? { ...row, isActive: saved.isActive, updatedAt: saved.updatedAt } : row,
      )
      return true
    } catch (err) {
      toggleError.value = messageOf(err)
      return false
    } finally {
      togglingId.value = null
    }
  }

  return {
    questions,
    loadError,
    load,
    deletingId,
    deleteError,
    remove,
    togglingId,
    toggleError,
    setActive,
  }
}
