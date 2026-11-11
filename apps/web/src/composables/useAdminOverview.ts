import type { InferResponseType } from 'hono/client'
import { ref } from 'vue'
import { api, call, messageOf } from '../lib/api'

export type AdminOverview = InferResponseType<typeof api.admin.overview.$get, 200>

/**
 * The counts on the admin overview page. Staff only; a failed load sets `error` in words. A
 * reload keeps the last counts on screen until the new ones come in.
 */
export function useAdminOverview() {
  const overview = ref<AdminOverview | null>(null)
  const error = ref<string | null>(null)
  const loading = ref(false)

  async function load() {
    loading.value = true
    error.value = null
    try {
      overview.value = await call(api.admin.overview.$get())
    } catch (err) {
      error.value = messageOf(err)
    } finally {
      loading.value = false
    }
  }

  return { overview, error, loading, load }
}
