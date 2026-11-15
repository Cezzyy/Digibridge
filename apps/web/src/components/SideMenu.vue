<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useId, watch } from 'vue'
import { useRoute } from 'vue-router'
import { askSignOut } from '../composables/useSignOut'
import { currentPageAttrs, type NavItem } from '../lib/nav'
import { useSessionStore } from '../stores/session'
import { ICONS } from './admin/admin-icons'
import StrokeIcon from './admin/StrokeIcon.vue'

// The phone menu behind AppHeader's menu button, used by AdminMenu (below `lg`) and AppMenu (the
// respondent pages, below `sm`): a panel from the left with the pages in `sections` (a line
// between each), then the signed-in user with Sign out (AUTH-03; it asks first, in a dialog over
// the menu, which closes once signed out), or Sign in when signed out, so the header keeps only
// the logo and this button. A native modal dialog, so focus stays inside,
// Esc closes it and focus goes back to the button. Picking a page, tapping the dim layer, going
// back, or widening the screen to `closeFrom` (where the header's own links are back) closes it
// too. It slides in and out, and its rows follow one after another (`.side-menu` in style.css),
// unless the user asks for less motion.
const props = defineProps<{
  /** The small heading at the top of the panel. */
  title: string
  /** The nav's accessible name. */
  navLabel: string
  sections: NavItem[][]
  /** A media query: from here the menu button is hidden, so the menu closes. */
  closeFrom: string
}>()

const session = useSessionStore()
const route = useRoute()
const id = useId()

const dialog = ref<HTMLDialogElement | null>(null)
const isOpen = ref(false)

// Each row's place in the stagger, counted across sections; the account comes last.
const rows = computed(() => {
  let index = 0
  return props.sections.map((items) => items.map((item) => ({ item, index: index++ })))
})
const footerIndex = computed(() => props.sections.flat().length)

function open() {
  dialog.value?.showModal()
  isOpen.value = true
}

function close() {
  if (dialog.value?.open) dialog.value.close()
}

// A click on the dialog itself, not its panel, is a click on the dim layer around it.
function onDialogClick(event: MouseEvent) {
  if (event.target === dialog.value) close()
}

// The path, not the query: pages rewrite their own query (a search, a filter) while the menu is open.
watch(() => route.path, close)

// A menu still open when the button hides would be stuck.
const wide = window.matchMedia(props.closeFrom)
function onWidthChange(event: MediaQueryListEvent) {
  if (event.matches) close()
}
onMounted(() => wide.addEventListener('change', onWidthChange))
onUnmounted(() => wide.removeEventListener('change', onWidthChange))

const LINK =
  'flex min-h-11 items-center gap-3 rounded-control px-3 font-semibold text-quiet transition-colors hover:bg-mist-soft hover:text-ink aria-[current=page]:bg-evergreen-soft aria-[current=page]:text-evergreen'
const FOOTER_BUTTON =
  'flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-line-strong px-4 font-semibold text-evergreen transition-colors hover:bg-evergreen-soft'
</script>

<template>
  <button
    type="button"
    aria-label="Open menu"
    aria-haspopup="dialog"
    :aria-controls="id"
    :aria-expanded="isOpen"
    class="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-control text-ink transition-colors hover:bg-mist-soft active:scale-95"
    @click="open"
  >
    <StrokeIcon :d="ICONS.menu" class="size-6" />
  </button>

  <dialog
    :id="id"
    ref="dialog"
    aria-label="Menu"
    class="side-menu my-0 mr-auto ml-0 h-dvh max-h-none w-full max-w-xs bg-surface text-ink shadow-lg backdrop:bg-scrim"
    @click="onDialogClick"
    @close="isOpen = false"
  >
    <div class="flex h-full flex-col">
      <div
        class="flex h-header shrink-0 items-center justify-between gap-3 border-b border-line px-4"
      >
        <p class="px-3 text-sm font-semibold tracking-wide text-quiet uppercase">{{ title }}</p>
        <button
          type="button"
          aria-label="Close menu"
          class="flex size-11 items-center justify-center rounded-control text-ink transition-[background-color,rotate] duration-200 hover:rotate-90 hover:bg-mist-soft"
          @click="close"
        >
          <StrokeIcon :d="ICONS.cross" class="size-6" />
        </button>
      </div>

      <nav :aria-label="navLabel" class="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <ul
          v-for="(section, sectionIndex) in rows"
          :key="sectionIndex"
          class="flex flex-col gap-1"
          :class="{ 'mt-4 border-t border-line pt-4': sectionIndex > 0 }"
        >
          <li
            v-for="{ item, index } in section"
            :key="item.label"
            class="side-menu-item"
            :style="{ '--item': index }"
          >
            <!-- RouterLink sets aria-current="page" on the page that's open; currentPageAttrs
                 on the pages under it. A link to the page already open doesn't change the
                 route, so the click closes the menu too. -->
            <RouterLink
              :to="item.to"
              v-bind="currentPageAttrs(item, route.name)"
              :class="LINK"
              @click="close"
            >
              <StrokeIcon :d="item.icon" class="size-5" />
              {{ item.label }}
            </RouterLink>
          </li>
        </ul>
      </nav>

      <div
        v-if="session.me"
        class="side-menu-item shrink-0 border-t border-line px-4 py-4"
        :style="{ '--item': footerIndex }"
      >
        <div class="flex items-center gap-3 px-3">
          <img
            v-if="session.me.profile.avatarUrl"
            :src="session.me.profile.avatarUrl"
            alt=""
            class="size-10 shrink-0 rounded-full"
            referrerpolicy="no-referrer"
          />
          <div class="min-w-0">
            <p class="truncate font-semibold">
              {{ session.me.profile.fullName ?? session.me.profile.email }}
            </p>
            <p v-if="session.me.profile.fullName" class="truncate text-sm text-quiet">
              {{ session.me.profile.email }}
            </p>
          </div>
        </div>
        <button type="button" :class="['mt-3', FOOTER_BUTTON]" @click="askSignOut">
          <StrokeIcon :d="ICONS.signOut" class="size-5" />
          Sign out
        </button>
      </div>

      <div
        v-else-if="!session.isSignedIn && !session.loading"
        class="side-menu-item shrink-0 border-t border-line px-4 py-4"
        :style="{ '--item': footerIndex }"
      >
        <RouterLink :to="{ name: 'sign-in' }" :class="FOOTER_BUTTON" @click="close">
          <StrokeIcon :d="ICONS.person" class="size-5" />
          Sign in
        </RouterLink>
      </div>
    </div>
  </dialog>
</template>
