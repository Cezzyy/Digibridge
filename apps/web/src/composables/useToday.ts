import { todayInPhilippines, type IsoDate } from '@digibridge/shared'
import { onScopeDispose, readonly, ref, type Ref } from 'vue'

// Today's date in the Philippines, kept current while a page stays open past midnight. One
// timer serves every caller, checking at the start of each minute (Manila's midnight falls on
// one), and stops when the last caller is gone.

const today = ref<IsoDate>(todayInPhilippines())
let users = 0
let timer: ReturnType<typeof setTimeout> | undefined

function tick() {
  const now = todayInPhilippines()
  if (now !== today.value) today.value = now
  timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50)
}

/**
 * Today's date in the Philippines as a ref. The birth date checks in `packages/shared` read the
 * clock themselves, so read this in any computed that runs them, so they run again on a new day.
 */
export function useToday(): Readonly<Ref<IsoDate>> {
  if (users++ === 0) tick()
  onScopeDispose(() => {
    if (--users === 0) clearTimeout(timer)
  })
  return readonly(today)
}
