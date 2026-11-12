import type { DashboardFilters } from '@digibridge/shared'
import type { InferResponseType } from 'hono/client'
import { ref } from 'vue'
import { api, call, messageOf } from '../lib/api'
import { filterQuery } from './useDashboardFilters'

export type ItemStats = InferResponseType<typeof api.admin.items.$get, 200>['items'][number]

/**
 * Item analysis (DSH-08), admin only: every question with its percent correct, choice picks and
 * flags, for the respondents the filters pick. Only the latest load counts.
 */
export function useItemAnalysis() {
  const items = ref<ItemStats[] | null>(null)
  const error = ref<string | null>(null)
  const loading = ref(false)
  let latest = 0

  async function load(filters: DashboardFilters) {
    const request = ++latest
    loading.value = true
    error.value = null
    try {
      const found = await call(api.admin.items.$get({ query: filterQuery(filters) }))
      if (request === latest) items.value = found.items
    } catch (err) {
      if (request === latest) error.value = messageOf(err)
    } finally {
      if (request === latest) loading.value = false
    }
  }

  return { items, error, loading, load }
}
