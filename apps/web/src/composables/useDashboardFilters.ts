import { dashboardFiltersSchema, type DashboardFilters } from '@digibridge/shared'
import { computed } from 'vue'
import { useRoute, useRouter, type LocationQuery, type LocationQueryRaw } from 'vue-router'

/** The filter names, which are also their query parameter names. */
export const FILTER_KEYS = Object.keys(dashboardFiltersSchema.shape) as (keyof DashboardFilters)[]

const first = (value: LocationQuery[string] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? null

/** The filters in a URL query. A value that isn't valid is left out, as if not set. */
export function filtersFrom(query: LocationQuery): DashboardFilters {
  const filters: Record<string, unknown> = {}
  for (const key of FILTER_KEYS) {
    const value = first(query[key])
    if (value === null) continue
    const parsed = dashboardFiltersSchema.shape[key].safeParse(value)
    if (parsed.success && parsed.data !== undefined) filters[key] = parsed.data
  }
  return filters as DashboardFilters
}

/** The filters as query parameters, for the API and for links between the admin pages. */
export function filterQuery(filters: DashboardFilters): Record<string, string> {
  const query: Record<string, string> = {}
  for (const key of FILTER_KEYS) {
    const value = filters[key]
    if (value !== undefined) query[key] = String(value)
  }
  return query
}

/**
 * The dashboard filters (DSH-03), kept in the URL so they survive a refresh and carry over
 * between the respondents, analysis and item pages (AdminLayout passes them on). `set` changes
 * some and drops `page`, since the old page may no longer exist.
 */
export function useDashboardFilters() {
  const route = useRoute()
  const router = useRouter()

  const filters = computed(() => filtersFrom(route.query))
  const activeCount = computed(() => Object.keys(filters.value).length)

  function replaceQuery(query: LocationQueryRaw) {
    return router.replace({ query })
  }

  function set(
    patch: Partial<Record<keyof DashboardFilters, DashboardFilters[keyof DashboardFilters] | null>>,
  ) {
    const query: LocationQueryRaw = { ...route.query, page: undefined }
    for (const [key, value] of Object.entries(patch)) {
      query[key] = value === null || value === undefined ? undefined : String(value)
    }
    return replaceQuery(query)
  }

  function clear() {
    const query: LocationQueryRaw = { ...route.query, page: undefined }
    for (const key of FILTER_KEYS) query[key] = undefined
    return replaceQuery(query)
  }

  return { filters, activeCount, set, clear }
}
