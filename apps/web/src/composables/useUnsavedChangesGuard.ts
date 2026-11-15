import { onUnmounted, ref, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/**
 * Asks before leaving an editor page with unsaved changes, inside the app and when closing the
 * tab, for the lessons and questions editors. Show a "Leave without saving?" dialog while
 * `leaving` is true and pass the choice to `answer`.
 *
 * A guard on the router, not onBeforeRouteLeave: /new and /:id share the editor page, so after a
 * new record's first save the page stays and the address becomes `savedRoute` with `savedId()`;
 * a leave guard would still belong to /new. That move, and any change of address that keeps the
 * page (`from.name` is no longer the page's), go through without asking.
 */
export function useUnsavedChangesGuard(
  dirty: Ref<boolean>,
  savedRoute: string,
  savedId: () => string | undefined,
) {
  const route = useRoute()
  const router = useRouter()
  const leaving = ref(false)
  let answerLeave: ((leave: boolean) => void) | null = null

  function answer(leave: boolean) {
    answerLeave?.(leave)
    answerLeave = null
    leaving.value = false
  }

  const removeGuard = router.beforeEach((to, from) => {
    const ownAddress =
      to.name === savedRoute && savedId() !== undefined && to.params.id === savedId()
    if (!dirty.value || from.name !== route.name || to.fullPath === from.fullPath || ownAddress)
      return true
    leaving.value = true
    return new Promise<boolean>((resolve) => (answerLeave = resolve))
  })

  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (dirty.value) event.preventDefault()
  }
  window.addEventListener('beforeunload', onBeforeUnload)
  onUnmounted(() => {
    removeGuard()
    answer(false)
    window.removeEventListener('beforeunload', onBeforeUnload)
  })

  return { leaving, answer }
}
