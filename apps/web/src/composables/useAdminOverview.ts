import type { InferResponseType } from 'hono/client'
import { ref } from 'vue'
import { api, call, messageOf } from '../lib/api'

export type AdminOverview = InferResponseType<typeof api.admin.overview.$get, 200>

/** The counts on the admin overview page. Staff only; a failed load sets `error` in words. */
export function useAdminOverview() {
  const overview = ref<AdminOverview | null>(null)
  const error = ref<string | null>(null)

  async function load() {
    error.value = null
    try {
      overview.value = await call(api.admin.overview.$get())
    } catch (err) {
      error.value = messageOf(err)
    }
  }

  return { overview, error, load }
}
