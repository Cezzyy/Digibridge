import type { StatsQuery } from '@digibridge/shared'
import type { InferResponseType } from 'hono/client'
import { ref } from 'vue'
import { api, call, messageOf } from '../lib/api'
import { filterQuery } from './useDashboardFilters'

export type AdminStats = InferResponseType<typeof api.admin.stats.$get, 200>

/**
 * The analysis page's numbers (DSH-01 to DSH-04, SUS-05), staff only. A reload keeps the last
 * numbers on screen until the new ones come in; only the latest load counts, so changing
 * filters quickly never ends on older numbers.
 */
export function useAdminStats() {
  const stats = ref<AdminStats | null>(null)
  const error = ref<string | null>(null)
  const loading = ref(false)
  let latest = 0

  async function load({ groupBy, ...filters }: StatsQuery) {
    const request = ++latest
    loading.value = true
    error.value = null
    try {
      const found = await call(
        api.admin.stats.$get({ query: { ...filterQuery(filters), groupBy } }),
      )
      if (request === latest) stats.value = found
    } catch (err) {
      if (request === latest) error.value = messageOf(err)
    } finally {
      if (request === latest) loading.value = false
    }
  }

  return { stats, error, loading, load }
}
