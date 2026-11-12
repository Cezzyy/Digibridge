import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  linkLockIssues,
  LINK_MAX_DAYS,
  LINK_MAX_RESPONSES,
  LINK_MESSAGES,
  linkExpiresAt,
  linkStatus,
  schoolLinkSchema,
} from './school-link'

describe('linkStatus', () => {
  const now = new Date('2026-11-11T04:00:00Z')
  const open = {
    closedAt: null,
    expiresAt: new Date('2026-11-12T16:00:00Z'),
    maxResponses: 40,
    responses: 39,
  }

  it('is open before its expiry and under its limit', () => {
    expect(linkStatus(open, now)).toBe('open')
    expect(linkStatus({ ...open, maxResponses: null, responses: 5000 }, now)).toBe('open')
  })

  it('is full at its limit', () => {
    expect(linkStatus({ ...open, responses: 40 }, now)).toBe('full')
  })

  it('is expired from its expiry on, even when full', () => {
    expect(linkStatus({ ...open, expiresAt: now }, now)).toBe('expired')
    expect(linkStatus({ ...open, expiresAt: now, responses: 40 }, now)).toBe('expired')
  })

  it('is closed once an admin closes it, whatever else holds', () => {
    expect(linkStatus({ ...open, closedAt: now, expiresAt: now, responses: 40 }, now)).toBe(
      'closed',
    )
  })
})

describe('linkExpiresAt', () => {
  it('is midnight after the last day, in the Philippines', () => {
    expect(linkExpiresAt('2026-11-20').toISOString()).toBe('2026-11-20T16:00:00.000Z')
    expect(linkExpiresAt('2026-12-31').toISOString()).toBe('2026-12-31T16:00:00.000Z')
  })
})

describe('schoolLinkSchema', () => {
  // 1 AM on Nov 11, 2026 in Manila, still Nov 10 in UTC: "today" must be the Philippine date.
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-10T17:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const link = { school: ' ACLC College of Mandaue ', label: 'BSIT 2A', expiresOn: '2026-11-20' }
  const messageFor = (input: unknown) => schoolLinkSchema.safeParse(input).error?.issues[0]?.message

  it('trims text and fills null for any course, year level and no limit', () => {
    expect(schoolLinkSchema.parse(link)).toEqual({
      school: 'ACLC College of Mandaue',
      label: 'BSIT 2A',
      course: null,
      yearLevel: null,
      maxResponses: null,
      expiresOn: '2026-11-20',
    })
  })

  it('takes a course, a year level in it and a limit', () => {
    const locks = { course: 'HRT', yearLevel: 3, maxResponses: 40 }
    expect(schoolLinkSchema.parse({ ...link, ...locks })).toMatchObject(locks)
    // A year level on its own is fine: any course, that year.
    expect(schoolLinkSchema.safeParse({ ...link, yearLevel: 4 }).success).toBe(true)
  })

  it('refuses a year level the course doesn’t have', () => {
    expect(messageFor({ ...link, course: 'HRT', yearLevel: 4 })).toBe(
      'HRT only goes up to 3rd year.',
    )
  })

  it.each([
    ['a blank school', { school: '   ' }, LINK_MESSAGES.school],
    ['a blank label', { label: '' }, LINK_MESSAGES.label],
    ['a long label', { label: 'x'.repeat(61) }, LINK_MESSAGES.labelTooLong],
    ['a limit of 0', { maxResponses: 0 }, LINK_MESSAGES.maxResponses],
    ['a limit over the max', { maxResponses: LINK_MAX_RESPONSES + 1 }, LINK_MESSAGES.maxResponses],
    ['a fractional limit', { maxResponses: 2.5 }, LINK_MESSAGES.maxResponses],
    ['a date that doesn’t exist', { expiresOn: '2026-11-31' }, LINK_MESSAGES.expiresOn],
    ['yesterday', { expiresOn: '2026-11-10' }, LINK_MESSAGES.expiresOnPast],
    ['a day too far ahead', { expiresOn: '2027-01-11' }, LINK_MESSAGES.expiresOnTooFar],
  ])('refuses %s', (_, fields, message) => {
    expect(messageFor({ ...link, ...fields })).toBe(message)
  })

  it(`takes today and the day ${LINK_MAX_DAYS} days ahead`, () => {
    expect(schoolLinkSchema.safeParse({ ...link, expiresOn: '2026-11-11' }).success).toBe(true)
    expect(schoolLinkSchema.safeParse({ ...link, expiresOn: '2027-01-10' }).success).toBe(true)
  })

  it('refuses fields it doesn’t list', () => {
    expect(messageFor({ ...link, code: 'ABC' })).toBe(
      'The link includes a field this form doesn’t have.',
    )
  })
})

describe('linkLockIssues', () => {
  const profile = { course: 'BSIT', yearLevel: 2 }

  it('lets any profile through a link without a lock', () => {
    expect(linkLockIssues({ course: null, yearLevel: null }, profile)).toEqual([])
  })

  it('lets a profile through that matches the lock', () => {
    expect(linkLockIssues({ course: 'BSIT', yearLevel: 2 }, profile)).toEqual([])
  })

  it('points at each field that doesn’t match', () => {
    expect(linkLockIssues({ course: 'BSCS', yearLevel: 3 }, profile)).toEqual([
      { path: ['course'], message: 'This link is only for BSCS students.' },
      { path: ['yearLevel'], message: 'This link is only for 3rd year students.' },
    ])
  })
})
