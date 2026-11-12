import type { DashboardFilters, RespondentSort, RespondentStatus } from '@digibridge/shared'
import type { InferResponseType } from 'hono/client'
import { ref } from 'vue'
import { api, call, messageOf } from '../lib/api'
import { filterQuery } from './useDashboardFilters'

export type RespondentPage = InferResponseType<typeof api.admin.respondents.$get, 200>
export type RespondentRow = RespondentPage['respondents'][number]

export type RespondentsQuery = DashboardFilters & {
  status?: RespondentStatus
  q?: string
  sort: RespondentSort
  page: number
}

/**
 * One page of the respondents table (DSH-05), staff only. A reload keeps the last page on screen
 * until the new one comes in, and only the latest load counts, so typing a search quickly never
 * ends on an older answer.
 */
export function useRespondents() {
  const page = ref<RespondentPage | null>(null)
  const error = ref<string | null>(null)
  const loading = ref(false)
  let latest = 0

  async function load({ status, q, sort, page: pageNumber, ...filters }: RespondentsQuery) {
    const request = ++latest
    loading.value = true
    error.value = null
    try {
      const query: Record<string, string> = {
        ...filterQuery(filters),
        sort,
        page: String(pageNumber),
      }
      if (status) query.status = status
      if (q) query.q = q
      const found = await call(api.admin.respondents.$get({ query }))
      if (request === latest) page.value = found
    } catch (err) {
      if (request === latest) error.value = messageOf(err)
    } finally {
      if (request === latest) loading.value = false
    }
  }

  return { page, error, loading, load }
}
