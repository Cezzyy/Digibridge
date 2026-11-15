import type { InferResponseType } from 'hono/client'
import { ref } from 'vue'
import { api, call, messageOf } from '../lib/api'

export type AdminLessonRow = InferResponseType<
  typeof api.admin.lessons.$get,
  200
>['lessons'][number]

/**
 * Every lesson for the lessons editor's list, drafts included (CMS-04), with deleting a draft.
 * Admin only. A delete takes the row out of the list, so no reload is needed.
 */
export function useAdminLessons() {
  const lessons = ref<AdminLessonRow[] | null>(null)
  const loadError = ref<string | null>(null)
  /** The draft being deleted, so only its button shows it's busy. */
  const deletingId = ref<string | null>(null)
  const deleteError = ref<string | null>(null)

  async function load() {
    loadError.value = null
    try {
      lessons.value = (await call(api.admin.lessons.$get())).lessons
    } catch (err) {
      loadError.value = messageOf(err)
    }
  }

  async function remove(id: string) {
    deletingId.value = id
    deleteError.value = null
    try {
      await call(api.admin.lessons[':id'].$delete({ param: { id } }))
      lessons.value = (lessons.value ?? []).filter((row) => row.id !== id)
      return true
    } catch (err) {
      deleteError.value = messageOf(err)
      return false
    } finally {
      deletingId.value = null
    }
  }

  return { lessons, loadError, load, deletingId, deleteError, remove }
}
