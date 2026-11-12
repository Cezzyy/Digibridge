import type { RouteLocationRaw } from 'vue-router'

/** A page in a menu (SideMenu, the admin side menu): its name, where it goes and its line icon. */
export type NavItem = { label: string; to: RouteLocationRaw; icon: string | readonly string[] }
