<script setup lang="ts">
import { daysInMonth, isRealDate, toIsoDate } from '@digibridge/shared'
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'

// The calendar that opens from DateField. With nothing picked it starts on the years, then
// months, then days, so a date 20 years back takes three taps; with a date picked it opens on
// that month. Keyboard: arrow keys move, Enter or Space picks, Page Up and Page Down change
// the month (with Shift, the year), Home and End go to the start and end of the week, and
// Escape closes. Dates outside `min` to `max` can't be picked.

type View = 'years' | 'months' | 'days'
type Ymd = { year: number; month: number; day: number }

const props = defineProps<{
  /** The picked date as `YYYY-MM-DD`, or null. */
  value: string | null
  min: string
  max: string
  /** The year shown first when nothing is picked yet. */
  startYear: number
  /** The field's label, to name the calendar for screen readers. */
  label: string
}>()
const emit = defineEmits<{ pick: [date: string]; close: [] }>()

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const date = Date.UTC(2000, i, 1)
  const name = (month: 'long' | 'short') =>
    new Intl.DateTimeFormat('en-US', { month, timeZone: 'UTC' }).format(date)
  return { long: name('long'), short: name('short') }
})
const WEEKDAYS = [
  ['Su', 'Sunday'],
  ['Mo', 'Monday'],
  ['Tu', 'Tuesday'],
  ['We', 'Wednesday'],
  ['Th', 'Thursday'],
  ['Fr', 'Friday'],
  ['Sa', 'Saturday'],
] as const

const parse = (date: string): Ymd => {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  return { year, month, day }
}
const iso = (d: Ymd) => toIsoDate(d.year, d.month, d.day)
const longDate = (d: Ymd) => `${MONTHS[d.month - 1]?.long} ${d.day}, ${d.year}`
const lastOf = (year: number, month: number) => toIsoDate(year, month, daysInMonth(year, month))

const clamp = (d: Ymd): Ymd => {
  const date = iso(d)
  return date < props.min ? parse(props.min) : date > props.max ? parse(props.max) : d
}
const inRange = (date: string) => date >= props.min && date <= props.max

const picked = computed(() => (props.value && isRealDate(props.value) ? props.value : null))
const isPickedYear = (year: number) => !!picked.value?.startsWith(`${year}-`)
const isPickedMonth = (month: number) =>
  !!picked.value?.startsWith(toIsoDate(cursor.value.year, month, 1).slice(0, 8))
const view = ref<View>(picked.value ? 'days' : 'years')
const cursor = ref<Ymd>(
  clamp(picked.value ? parse(picked.value) : { year: props.startYear, month: 1, day: 1 }),
)

const root = useTemplateRef<HTMLElement>('root')

/** Moves focus to the cursor's button, scrolling only the year list, never the page. */
async function focusCursor() {
  await nextTick()
  const button = root.value?.querySelector<HTMLElement>('[data-cursor]')
  if (!button) return
  button.focus({ preventScroll: true })
  const list = button.closest<HTMLElement>('[data-scroll]')
  if (list) {
    const top = button.offsetTop - list.offsetTop
    if (top < list.scrollTop || top + button.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = top - list.clientHeight / 2 + button.offsetHeight / 2
    }
  }
}
onMounted(focusCursor)

function moveTo(d: Ymd, focus = true) {
  cursor.value = clamp(d)
  if (focus) void focusCursor()
}
function addDays(n: number) {
  const { year, month, day } = cursor.value
  const t = new Date(Date.UTC(year, month - 1, day + n))
  moveTo({ year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() })
}
function addMonths(n: number, focus = true) {
  const total = cursor.value.year * 12 + cursor.value.month - 1 + n
  const year = Math.floor(total / 12)
  const month = (total % 12) + 1
  moveTo({ year, month, day: Math.min(cursor.value.day, daysInMonth(year, month)) }, focus)
}
function show(next: View) {
  view.value = next
  void focusCursor()
}

// Years: newest first, four to a row.
const years = computed(() => {
  const newest = parse(props.max).year
  const oldest = parse(props.min).year
  return Array.from({ length: newest - oldest + 1 }, (_, i) => newest - i)
})
function pickYear(year: number) {
  const month = cursor.value.month
  moveTo({ year, month, day: Math.min(cursor.value.day, daysInMonth(year, month)) }, false)
  show('months')
}

// Months of the cursor's year, three to a row. A month is off when none of its days are.
const monthOff = (month: number) =>
  lastOf(cursor.value.year, month) < props.min || toIsoDate(cursor.value.year, month, 1) > props.max
function pickMonth(month: number) {
  const year = cursor.value.year
  moveTo({ year, month, day: Math.min(cursor.value.day, daysInMonth(year, month)) }, false)
  show('days')
}

// Days of the cursor's month, in weeks from Sunday; empty cells before the 1st and after the end.
const weeks = computed(() => {
  const { year, month } = cursor.value
  const lead = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const cells: (Ymd | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth(year, month) }, (_, i) => ({ year, month, day: i + 1 })),
  ]
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))
})
const prevOff = computed(() => toIsoDate(cursor.value.year, cursor.value.month, 1) <= props.min)
const nextOff = computed(() => lastOf(cursor.value.year, cursor.value.month) >= props.max)

const isCursor = (d: Ymd) =>
  d.year === cursor.value.year && d.month === cursor.value.month && d.day === cursor.value.day

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }
  // Only inside the grid: the header buttons keep their own keys.
  if (!(event.target as HTMLElement).closest('[data-grid]')) return
  const { year, month } = cursor.value
  const moves: Record<View, Partial<Record<string, () => void>>> = {
    years: {
      ArrowLeft: () => moveTo({ ...cursor.value, year: year + 1 }),
      ArrowRight: () => moveTo({ ...cursor.value, year: year - 1 }),
      ArrowUp: () => moveTo({ ...cursor.value, year: year + 4 }),
      ArrowDown: () => moveTo({ ...cursor.value, year: year - 4 }),
    },
    months: {
      ArrowLeft: () => month > 1 && addMonths(-1),
      ArrowRight: () => month < 12 && addMonths(1),
      ArrowUp: () => month > 3 && addMonths(-3),
      ArrowDown: () => month < 10 && addMonths(3),
    },
    days: {
      ArrowLeft: () => addDays(-1),
      ArrowRight: () => addDays(1),
      ArrowUp: () => addDays(-7),
      ArrowDown: () => addDays(7),
      Home: () => addDays(-new Date(Date.UTC(year, month - 1, cursor.value.day)).getUTCDay()),
      End: () => addDays(6 - new Date(Date.UTC(year, month - 1, cursor.value.day)).getUTCDay()),
      PageUp: () => addMonths(event.shiftKey ? -12 : -1),
      PageDown: () => addMonths(event.shiftKey ? 12 : 1),
    },
  }
  const move = moves[view.value][event.key]
  if (!move) return
  event.preventDefault()
  move()
}

const CELL =
  'grid place-items-center font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-evergreen disabled:cursor-not-allowed disabled:font-normal disabled:text-line-strong disabled:opacity-50'
const cellState = (isPicked: boolean) =>
  isPicked ? 'bg-evergreen text-white hover:bg-evergreen-hover' : 'hover:bg-evergreen-soft'

const HEADER_BUTTON =
  'inline-flex min-h-10 items-center gap-1 rounded-control px-2.5 font-display text-lg font-bold transition-colors hover:bg-evergreen-soft focus-visible:outline-2 focus-visible:outline-evergreen'
const ARROW_BUTTON =
  'grid size-10 place-items-center rounded-full text-evergreen transition-colors hover:bg-evergreen-soft focus-visible:outline-2 focus-visible:outline-evergreen disabled:cursor-not-allowed disabled:text-line-strong disabled:opacity-50 disabled:hover:bg-transparent'
</script>

<template>
  <div
    ref="root"
    role="dialog"
    tabindex="-1"
    :aria-label="`${label}: calendar`"
    class="w-full rounded-card border border-line bg-surface p-3 shadow-[0_16px_40px_-16px_rgb(18_36_28/0.35)] outline-none sm:w-[22rem] sm:p-4"
    @keydown="onKeydown"
  >
    <!-- Years -->
    <template v-if="view === 'years'">
      <p class="px-1 pt-1 pb-3 font-display text-lg font-bold">Pick the year</p>
      <div
        data-grid
        data-scroll
        role="listbox"
        aria-label="Year"
        class="relative -m-1 grid max-h-64 grid-cols-4 gap-1 overflow-y-auto overscroll-contain p-1"
      >
        <button
          v-for="year in years"
          :key="year"
          type="button"
          role="option"
          :aria-selected="isPickedYear(year)"
          :tabindex="year === cursor.year ? 0 : -1"
          :data-cursor="year === cursor.year ? '' : undefined"
          :class="[CELL, 'h-11 rounded-control', cellState(isPickedYear(year))]"
          @click="pickYear(year)"
        >
          {{ year }}
        </button>
      </div>
    </template>

    <!-- Months -->
    <template v-else-if="view === 'months'">
      <div class="flex items-center justify-between pb-3">
        <button
          type="button"
          :class="HEADER_BUTTON"
          aria-label="Change the year"
          @click="show('years')"
        >
          {{ cursor.year }}
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            class="size-5 fill-none stroke-current stroke-2"
          >
            <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <p class="pr-1 text-sm font-semibold text-quiet">Pick the month</p>
      </div>
      <div data-grid role="listbox" aria-label="Month" class="grid grid-cols-3 gap-1.5">
        <button
          v-for="(name, i) in MONTHS"
          :key="name.short"
          type="button"
          role="option"
          :aria-label="`${name.long} ${cursor.year}`"
          :aria-selected="isPickedMonth(i + 1)"
          :disabled="monthOff(i + 1)"
          :tabindex="i + 1 === cursor.month ? 0 : -1"
          :data-cursor="i + 1 === cursor.month ? '' : undefined"
          :class="[CELL, 'h-12 rounded-control', cellState(isPickedMonth(i + 1))]"
          @click="pickMonth(i + 1)"
        >
          {{ name.short }}
        </button>
      </div>
    </template>

    <!-- Days -->
    <template v-else>
      <div class="flex items-center justify-between gap-1 pb-2">
        <button
          type="button"
          :class="ARROW_BUTTON"
          :disabled="prevOff"
          aria-label="Previous month"
          @click="addMonths(-1, false)"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            class="size-5 fill-none stroke-current stroke-2"
          >
            <path d="m15 6-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          :class="HEADER_BUTTON"
          aria-label="Change the month and year"
          @click="show('years')"
        >
          <span aria-live="polite"> {{ MONTHS[cursor.month - 1]?.long }} {{ cursor.year }} </span>
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            class="size-5 fill-none stroke-current stroke-2"
          >
            <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          :class="ARROW_BUTTON"
          :disabled="nextOff"
          aria-label="Next month"
          @click="addMonths(1, false)"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            class="size-5 fill-none stroke-current stroke-2"
          >
            <path d="m9 6 6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
      <table data-grid role="grid" class="w-full table-fixed border-separate border-spacing-y-0.5">
        <thead>
          <tr>
            <th
              v-for="[short, long] in WEEKDAYS"
              :key="short"
              scope="col"
              :abbr="long"
              class="pb-1 text-xs font-semibold text-quiet"
            >
              {{ short }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(week, w) in weeks" :key="w">
            <td
              v-for="(d, i) in week"
              :key="i"
              :role="d ? 'gridcell' : undefined"
              :aria-selected="d ? iso(d) === picked : undefined"
              class="p-0 text-center"
            >
              <button
                v-if="d"
                type="button"
                :aria-label="longDate(d)"
                :disabled="!inRange(iso(d))"
                :tabindex="isCursor(d) ? 0 : -1"
                :data-cursor="isCursor(d) ? '' : undefined"
                :class="[
                  CELL,
                  'mx-auto size-9 rounded-full sm:size-10',
                  cellState(iso(d) === picked),
                ]"
                @click="emit('pick', iso(d))"
              >
                {{ d.day }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>
