// Numbers on the analysis and item pages. Averages keep one decimal; a missing one is a dash.

export const NO_VALUE = '—'

/** "57.3%", or a dash when nobody counts. */
export const pctText = (pct: number | null) => (pct === null ? NO_VALUE : `${pct.toFixed(1)}%`)

/** A part of a whole as a whole percentage of it, 0 when the whole is 0. */
export const shareOf = (part: number, whole: number) => (whole === 0 ? 0 : (part * 100) / whole)

export const countText = (n: number, one: string, many: string) =>
  `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
