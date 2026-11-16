import { describe, expect, it } from 'vitest'
import { AGE_MAX, AGE_MIN } from '../profile/birth-date'
import { AGE_GROUP_RANGES, AGE_GROUPS, ageGroupFor } from './age-groups'
import { exportItemCode, exportQuerySchema } from './export'
import { dashboardFiltersSchema, hasSchoolOnlyFilter } from './filters'
import { respondentListQuerySchema, VOID_NOTE_MAX_LENGTH, voidAttemptSchema } from './respondents'
import { statsQuerySchema } from './stats'

describe('age groups', () => {
  it('cover AGE_MIN to AGE_MAX with no gaps or overlaps', () => {
    const ranges = AGE_GROUPS.map((group) => AGE_GROUP_RANGES[group])
    expect(ranges[0]?.min).toBe(AGE_MIN)
    expect(ranges.at(-1)?.max).toBe(AGE_MAX)
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i]?.min).toBe((ranges[i - 1]?.max ?? 0) + 1)
    }
  })

  it.each([
    [AGE_MIN, 'under_18'],
    [17, 'under_18'],
    [18, '18_20'],
    [20, '18_20'],
    [21, '21_23'],
    [23, '21_23'],
    [24, '24_up'],
    [AGE_MAX, '24_up'],
  ])('puts %i in %s', (age, group) => {
    expect(ageGroupFor(age)).toBe(group)
  })
})

describe('dashboardFiltersSchema', () => {
  it('takes no filters', () => {
    expect(dashboardFiltersSchema.parse({})).toEqual({})
  })

  it('reads a year level sent as text', () => {
    expect(dashboardFiltersSchema.parse({ yearLevel: '2' })).toEqual({ yearLevel: 2 })
  })

  it.each([
    ['an unknown sex', { sex: 'other' }],
    ['a year level out of range', { yearLevel: '5' }],
    ['a date that doesn’t exist', { from: '2026-02-30' }],
    ['a link that isn’t an id', { schoolLinkId: 'BSIT-2A' }],
  ])('refuses %s', (_, query) => {
    expect(dashboardFiltersSchema.safeParse(query).success).toBe(false)
  })

  it('knows which filters are school only', () => {
    expect(hasSchoolOnlyFilter({ sex: 'female', mode: 'online' })).toBe(false)
    expect(hasSchoolOnlyFilter({ course: 'BSIT' })).toBe(true)
    expect(hasSchoolOnlyFilter({ yearLevel: 1 })).toBe(true)
  })
})

describe('respondentListQuerySchema', () => {
  it('starts on page 1, newest first', () => {
    expect(respondentListQuerySchema.parse({})).toEqual({ sort: 'newest', page: 1 })
  })

  it('reads the page sent as text and trims the search', () => {
    expect(respondentListQuerySchema.parse({ page: '3', q: '  Cruz ' })).toMatchObject({
      page: 3,
      q: 'Cruz',
    })
  })

  it.each([['0'], ['1.5'], ['two']])('refuses page %s', (page) => {
    expect(respondentListQuerySchema.safeParse({ page }).success).toBe(false)
  })
})

describe('statsQuerySchema', () => {
  it('groups by mode unless told otherwise', () => {
    expect(statsQuerySchema.parse({})).toEqual({ groupBy: 'mode' })
    expect(statsQuerySchema.parse({ groupBy: 'course', sex: 'female' })).toEqual({
      groupBy: 'course',
      sex: 'female',
    })
  })

  it('refuses an unknown grouping', () => {
    expect(statsQuerySchema.safeParse({ groupBy: 'name' }).success).toBe(false)
  })
})

describe('voidAttemptSchema', () => {
  it('takes a reason with no note', () => {
    expect(voidAttemptSchema.parse({ reason: 'technical' })).toEqual({
      reason: 'technical',
      note: null,
    })
  })

  it('trims the note', () => {
    expect(voidAttemptSchema.parse({ reason: 'duplicate', note: '  Second account ' }).note).toBe(
      'Second account',
    )
  })

  it('needs a note with other', () => {
    expect(voidAttemptSchema.safeParse({ reason: 'other' }).success).toBe(false)
    expect(voidAttemptSchema.safeParse({ reason: 'other', note: '   ' }).success).toBe(false)
    expect(voidAttemptSchema.safeParse({ reason: 'other', note: 'Fire drill' }).success).toBe(true)
  })

  it('refuses an unknown reason and a long note', () => {
    expect(voidAttemptSchema.safeParse({ reason: 'bored' }).success).toBe(false)
    expect(
      voidAttemptSchema.safeParse({
        reason: 'technical',
        note: 'x'.repeat(VOID_NOTE_MAX_LENGTH + 1),
      }).success,
    ).toBe(false)
  })
})

describe('exportQuerySchema', () => {
  it('takes the table’s query without the page', () => {
    expect(exportQuerySchema.parse({ sort: 'name', page: '3', status: 'finished' })).toEqual({
      sort: 'name',
      status: 'finished',
    })
  })
})

describe('exportItemCode', () => {
  it('names a question by area, difficulty and number', () => {
    expect(exportItemCode('info_literacy', 'basic', 1)).toBe('INF-B01')
    expect(exportItemCode('safety', 'advanced', 12)).toBe('SAF-A12')
  })
})
