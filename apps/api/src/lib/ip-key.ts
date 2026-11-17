// The rate limits' key for a client IP. One IPv6 user or network usually holds a whole /64 (or
// more) and can pick a new source address from it for every request, so IPv6 counts per /64.
// IPv4 counts per address.

const HEXTET = /^[0-9a-f]{1,4}$/i
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

/** A run of `:`-separated groups, with an IPv4 tail (`1.2.3.4`) turned into its 2 hextets. */
function groupsOf(run: string): number[] | undefined {
  if (run === '') return []
  const groups = run.split(':')
  const v4 = IPV4.exec(groups[groups.length - 1] ?? '')
  const tail: number[] = []
  if (v4) {
    const [a, b, c, d] = v4.slice(1).map(Number) as [number, number, number, number]
    if (Math.max(a, b, c, d) > 255) return undefined
    groups.pop()
    tail.push((a << 8) | b, (c << 8) | d)
  }
  if (!groups.every((g) => HEXTET.test(g))) return undefined
  return [...groups.map((g) => parseInt(g, 16)), ...tail]
}

/** The 8 hextets of an IPv6 address, or undefined if it isn't one. */
function hextets(ip: string): number[] | undefined {
  const halves = ip.split('::')
  if (halves.length > 2) return undefined
  const head = groupsOf(halves[0] ?? '')
  const tail = halves.length === 2 ? groupsOf(halves[1] ?? '') : []
  if (!head || !tail) return undefined
  const missing = 8 - head.length - tail.length
  // Without `::` all 8 are written out; `::` stands for at least one zero group.
  if (halves.length === 1 ? missing !== 0 : missing < 1) return undefined
  return [...head, ...Array<number>(missing).fill(0), ...tail]
}

/**
 * `ip` as a rate-limit key: an IPv6 address becomes its /64 (`2001:db8:0:1::/64`), an
 * IPv4-mapped one (`::ffff:203.0.113.7`) its IPv4 address. Anything else is kept as given.
 */
export function ipKey(ip: string): string {
  if (!ip.includes(':')) return ip
  const h = hextets(ip.split('%')[0] ?? '')
  if (!h) return ip
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, i = 0] = h
  if (a === 0 && b === 0 && c === 0 && d === 0 && e === 0 && f === 0xffff) {
    return [g >> 8, g & 255, i >> 8, i & 255].join('.')
  }
  return `${[a, b, c, d].map((x) => x.toString(16)).join(':')}::/64`
}
