import { describe, expect, it } from 'vitest'
import { AGE_MAX, AGE_MIN } from '../profile/birth-date'
import { AGE_GROUP_RANGES, AGE_GROUPS, ageGroupFor } from './age-groups'
import { dashboardFiltersSchema, hasSchoolOnlyFilter } from './filters'
import { respondentListQuerySchema } from './respondents'

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
