import type { SchoolLinkInput } from '@digibridge/shared'
import type { InferResponseType } from 'hono/client'
import { ref } from 'vue'
import { api, call, messageOf } from '../lib/api'

export type SchoolLinkRow = InferResponseType<typeof api.admin.links.$get, 200>[number]

/** The address students open for a link (LNK-02). The page itself comes with the school flow. */
export const linkUrl = (code: string) => `${window.location.origin}/s/${code}`

/**
 * The school links on the links page, newest first, with making and closing one (LNK-01).
 * Admin only. Each action keeps the list in step with the API's answer, so no reload is needed.
 */
export function useSchoolLinks() {
  const links = ref<SchoolLinkRow[] | null>(null)
  const loadError = ref<string | null>(null)
  const creating = ref(false)
  const createError = ref<string | null>(null)
  /** The link being closed, so only its button shows it's busy. */
  const closingId = ref<string | null>(null)
  const closeError = ref<string | null>(null)

  async function load() {
    loadError.value = null
    try {
      links.value = await call(api.admin.links.$get())
    } catch (err) {
      loadError.value = messageOf(err)
    }
  }

  /** Resolves the new link, or null with `createError` set. */
  async function create(input: SchoolLinkInput) {
    creating.value = true
    createError.value = null
    try {
      const link = await call(api.admin.links.$post({ json: input }))
      links.value = [link, ...(links.value ?? [])]
      return link
    } catch (err) {
      createError.value = messageOf(err)
      return null
    } finally {
      creating.value = false
    }
  }

  async function close(id: string) {
    closingId.value = id
    closeError.value = null
    try {
      const link = await call(api.admin.links[':id'].close.$post({ param: { id } }))
      links.value = (links.value ?? []).map((row) => (row.id === id ? link : row))
      return true
    } catch (err) {
      closeError.value = messageOf(err)
      return false
    } finally {
      closingId.value = null
    }
  }

  return { links, loadError, load, creating, createError, create, closingId, closeError, close }
}
