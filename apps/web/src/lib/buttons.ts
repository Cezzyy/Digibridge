// Classes for the app's button styles, on <button> or <RouterLink>. The first action on a
// screen is the primary one. Tap targets are at least 48 px tall.
const BUTTON =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-6 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-evergreen disabled:cursor-wait'

export const PRIMARY_BUTTON = `${BUTTON} bg-evergreen text-white hover:bg-evergreen-hover disabled:bg-evergreen-hover`
export const SECONDARY_BUTTON = `${BUTTON} border border-line-strong text-evergreen hover:bg-evergreen-soft`
/** For an action that can't be undone, like closing a school link. Used on admin pages. */
export const DANGER_BUTTON = `${BUTTON} border border-error text-error hover:bg-error-soft`
