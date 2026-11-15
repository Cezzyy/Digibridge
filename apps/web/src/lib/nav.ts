import type { RouteLocationRaw, RouteRecordNameGeneric } from 'vue-router'

/**
 * A page in a menu (SideMenu, the admin side menu): its name, where it goes and its line icon.
 * `currentOn` names the routes under it (the lesson editor under Lessons), where it shows as the
 * open page too.
 */
export type NavItem = {
  label: string
  to: RouteLocationRaw
  icon: string | readonly string[]
  currentOn?: readonly string[]
}

/**
 * `aria-current="page"` for an item whose `currentOn` holds the route open now. RouterLink sets
 * it by itself on its own page only, so this is bound beside it, and adds nothing otherwise.
 */
export const currentPageAttrs = (item: NavItem, route: RouteRecordNameGeneric) =>
  typeof route === 'string' && item.currentOn?.includes(route)
    ? { 'aria-current': 'page' as const }
    : {}
