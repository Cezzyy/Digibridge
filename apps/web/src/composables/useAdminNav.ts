import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ICONS } from '../components/admin/admin-icons'
import type { NavItem } from '../lib/nav'
import { useSessionStore } from '../stores/session'
import { filterQuery, filtersFrom } from './useDashboardFilters'

// The admin area's pages, for the side menu (AdminLayout, from `lg`) and the menu that opens from
// the header below that (AdminMenu). The questions editor (CMS-01), Item analysis, which shows
// the right answers (DSH-08), School links (LNK-01) and the lessons editor (CMS-04) show for
// admins only; the router keeps facilitators out of them too. Student
// preview opens /home, where staff can try the student steps without saving anything. The pages
// that take the dashboard filters get the ones set now, so they carry over (DSH-03).
export function useAdminNav() {
  const session = useSessionStore()
  const route = useRoute()
  const filters = computed(() => filterQuery(filtersFrom(route.query)))

  return computed<NavItem[]>(() => [
    { label: 'Overview', to: { name: 'admin' }, icon: ICONS.overview },
    {
      label: 'Respondents',
      to: { name: 'admin-respondents', query: filters.value },
      icon: ICONS.people,
    },
    {
      label: 'Analysis',
      to: { name: 'admin-analysis', query: filters.value },
      icon: ICONS.started,
    },
    ...(session.isAdmin
      ? [
          {
            label: 'Questions',
            to: { name: 'admin-questions' },
            icon: ICONS.question,
            currentOn: ['admin-question-new', 'admin-question'],
          },
          {
            label: 'Item analysis',
            to: { name: 'admin-items', query: filters.value },
            icon: ICONS.items,
          },
          { label: 'School links', to: { name: 'admin-links' }, icon: ICONS.link },
          {
            label: 'Lessons',
            to: { name: 'admin-lessons' },
            icon: ICONS.lessons,
            currentOn: ['admin-lesson-new', 'admin-lesson'],
          },
        ]
      : []),
    { label: 'Student preview', to: { name: 'home' }, icon: ICONS.preview },
  ])
}
