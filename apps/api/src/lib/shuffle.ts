// Random order for an attempt's items and choices (ASM-02), from the Web Crypto random source.

/** A whole number from 0 to `max - 1`, with no lean toward any of them. */
export function randomInt(max: number): number {
  if (!Number.isInteger(max) || max < 1 || max > 2 ** 32) {
    throw new RangeError(`randomInt needs a whole number from 1 to 2^32, got ${max}`)
  }
  // Values at or past the last full multiple of `max` would make the lower numbers more likely,
  // so draw again when one comes up.
  const limit = 2 ** 32 - (2 ** 32 % max)
  const draw = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(draw)
    const value = draw[0] ?? 0
    if (value < limit) return value % max
  }
}

/** A shuffled copy (Fisher–Yates). The input is left as it was. */
export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[result[i], result[j]] = [result[j] as T, result[i] as T]
  }
  return result
}
