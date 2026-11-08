import { describe, expect, it, vi } from 'vitest'
import {
  AGE_MAX,
  AGE_MIN,
  ageOn,
  BIRTH_DATE_MESSAGES,
  birthDateRange,
  birthDateSchema,
  daysInMonth,
  isRealDate,
  nextDay,
  todayInPhilippines,
  toIsoDate,
  yearsBefore,
} from './birth-date'

describe('ageOn', () => {
  it('counts a year only once the birthday has come', () => {
    expect(ageOn('2007-06-15', '2026-06-14')).toBe(18)
    expect(ageOn('2007-06-15', '2026-06-15')).toBe(19)
    expect(ageOn('2007-06-15', '2026-12-31')).toBe(19)
  })

  it('makes someone born on February 29 a year older on March 1 in other years', () => {
    expect(ageOn('2008-02-29', '2026-02-28')).toBe(17)
    expect(ageOn('2008-02-29', '2026-03-01')).toBe(18)
    expect(ageOn('2008-02-29', '2028-02-29')).toBe(20)
  })
})

describe('dates', () => {
  it('knows month lengths and leap years', () => {
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2028, 2)).toBe(29)
    expect(daysInMonth(2000, 2)).toBe(29)
    expect(daysInMonth(1900, 2)).toBe(28)
    expect(daysInMonth(2026, 4)).toBe(30)
    expect(daysInMonth(2026, 12)).toBe(31)
  })

  it('checks that a date exists', () => {
    expect(isRealDate('2008-02-29')).toBe(true)
    for (const bad of ['2007-02-29', '2007-04-31', '2007-13-01', '2007-00-10', '2007-6-15']) {
      expect(isRealDate(bad)).toBe(false)
    }
  })

  it('pads dates the way Postgres sends them', () => {
    expect(toIsoDate(2007, 6, 5)).toBe('2007-06-05')
  })

  it('takes today from Philippine time', () => {
    // 4 PM UTC on Nov 8 is already Nov 9 in Manila (UTC+8).
    expect(todayInPhilippines(new Date('2026-11-08T16:00:00Z'))).toBe('2026-11-09')
    expect(todayInPhilippines(new Date('2026-11-08T15:59:59Z'))).toBe('2026-11-08')
  })
})

describe('birthDateSchema', () => {
  // Fake only Date, so the schema's "today" is fixed.
  const at = (iso: string) => vi.useFakeTimers({ now: new Date(iso), toFake: ['Date'] })
  const message = (input: unknown) => birthDateSchema.safeParse(input).error?.issues[0]?.message

  it(`takes ages ${AGE_MIN} to ${AGE_MAX} on today's date in the Philippines`, () => {
    at('2026-11-08T04:00:00Z')
    expect(birthDateSchema.parse(`${2026 - AGE_MIN}-11-08`)).toBe(`${2026 - AGE_MIN}-11-08`)
    expect(message(`${2026 - AGE_MIN}-11-09`)).toContain(`${AGE_MIN} to ${AGE_MAX}`)
    expect(birthDateSchema.safeParse(`${2026 - AGE_MAX - 1}-11-09`).success).toBe(true)
    expect(message(`${2026 - AGE_MAX - 1}-11-08`)).toContain(`${AGE_MIN} to ${AGE_MAX}`)
    vi.useRealTimers()
  })

  it.each([
    [undefined, BIRTH_DATE_MESSAGES.missing],
    ['', BIRTH_DATE_MESSAGES.missing],
    ['06/15/2007', BIRTH_DATE_MESSAGES.incomplete],
    ['06/1', BIRTH_DATE_MESSAGES.incomplete],
    ['2007-02-30', BIRTH_DATE_MESSAGES.notReal],
    ['2007-13-01', BIRTH_DATE_MESSAGES.notReal],
    ['2026-11-09', BIRTH_DATE_MESSAGES.future],
    ['2020-01-01', BIRTH_DATE_MESSAGES.outOfRange],
    ['1900-01-01', BIRTH_DATE_MESSAGES.outOfRange],
  ])('refuses %j with only "%s"', (input, expected) => {
    at('2026-11-08T04:00:00Z')
    const issues = birthDateSchema.safeParse(input).error?.issues
    expect(issues?.map((issue) => issue.message)).toEqual([expected])
    vi.useRealTimers()
  })
})

describe('birthDateRange', () => {
  it('matches ageOn at both ends', () => {
    for (const today of ['2026-11-08', '2028-02-29', '2027-03-01', '2026-01-01']) {
      const { earliest, latest } = birthDateRange(today)
      expect(ageOn(latest, today)).toBe(AGE_MIN)
      expect(ageOn(nextDay(latest), today)).toBe(AGE_MIN - 1)
      expect(ageOn(earliest, today)).toBe(AGE_MAX)
      expect(ageOn(yearsBefore(today, AGE_MAX + 1), today)).toBe(AGE_MAX + 1)
    }
  })

  it('moves February 29 to February 28 in other years', () => {
    expect(yearsBefore('2028-02-29', 10)).toBe('2018-02-28')
    expect(nextDay('2026-12-31')).toBe('2027-01-01')
  })
})
