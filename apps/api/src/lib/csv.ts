import { philippineDateTime, type Cell, type Sheet } from './sheet'

// A sheet as CSV (RFC 4180): comma separated, CRLF line ends, UTF-8 with a byte order mark so
// Excel reads names with ñ or curly quotes right.

const BOM = '\uFEFF'

/**
 * Text that starts like a formula (=, +, -, @, or a tab or return) gets a leading apostrophe,
 * so a spreadsheet shows it as text instead of running it. Numbers are left alone.
 */
const FORMULA_START = /^[=+\-@\t\r]/

function field(cell: Cell): string {
  if (cell === null) return ''
  if (typeof cell === 'number') return String(cell)
  const text = cell instanceof Date ? philippineDateTime(cell) : cell
  const safe = FORMULA_START.test(text) ? `'${text}` : text
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv({ columns, rows }: Sheet): string {
  const lines = [
    columns.map((column) => field(column.header)),
    ...rows.map((row) => row.map(field)),
  ]
  return BOM + lines.map((line) => line.join(',')).join('\r\n') + '\r\n'
}
