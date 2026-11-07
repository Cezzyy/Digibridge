import { describe, expect, it } from 'vitest'
import { AGE_MAX, AGE_MIN, generalProfileSchema } from './general'
import { kioskProfileSchema, SCHOOL_FIELDS } from './kiosk'

const general = {
  fullName: '  Juan Dela Cruz ',
  age: 19,
  sex: 'male',
  devices: ['smartphone', 'laptop'],
  internetAccess: ['mobile_data'],
}

const school = { studentNumber: 'c23-01-7557-man121', course: 'BSIT', yearLevel: 2 }

describe('generalProfileSchema', () => {
  it('accepts the general fields and trims the name', () => {
    expect(generalProfileSchema.parse(general)).toEqual({ ...general, fullName: 'Juan Dela Cruz' })
  })

  it.each(SCHOOL_FIELDS)('refuses the school field %s (PRO-06)', (field) => {
    expect(generalProfileSchema.safeParse({ ...general, [field]: school[field] }).success).toBe(
      false,
    )
  })

  it('refuses a blank name and ages outside the range', () => {
    for (const bad of [
      { fullName: '   ' },
      { age: AGE_MIN - 1 },
      { age: AGE_MAX + 1 },
      { age: 19.5 },
      { age: '19' },
    ]) {
      expect(generalProfileSchema.safeParse({ ...general, ...bad }).success).toBe(false)
    }
  })

  it('needs at least one pick, no repeats, and "none" only on its own', () => {
    for (const bad of [
      { devices: [] },
      { devices: ['laptop', 'laptop'] },
      { devices: ['none', 'laptop'] },
      { internetAccess: ['none', 'home_wifi'] },
      { devices: ['phone'] },
    ]) {
      expect(generalProfileSchema.safeParse({ ...general, ...bad }).success).toBe(false)
    }
    expect(generalProfileSchema.safeParse({ ...general, devices: ['none'] }).success).toBe(true)
  })

  it('gives a repeated "none" only the repeat message', () => {
    const result = generalProfileSchema.safeParse({ ...general, devices: ['none', 'none'] })
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'Pick each device only once.',
    ])
  })
})

// Zod's own text ("Invalid option: expected one of ...") isn't written for students.
const ZOD_DEFAULT_TEXT = /invalid|expected|unrecognized|received/i

describe('profile messages', () => {
  const bad = {
    fullName: undefined,
    age: undefined,
    sex: 'other',
    devices: 'laptop',
    internetAccess: ['wifi'],
    email: 'a@b.c',
  }

  it.each([
    ['general', generalProfileSchema, {}],
    ['kiosk', kioskProfileSchema, { studentNumber: 7557, course: 'BSN', yearLevel: '2' }],
  ] as const)('are plain English for every bad %s field', (_, schema, schoolFields) => {
    const result = schema.safeParse({ ...bad, ...schoolFields })
    expect(result.error?.issues.length).toBeGreaterThan(0)
    for (const issue of result.error?.issues ?? []) {
      expect(issue.message).not.toMatch(ZOD_DEFAULT_TEXT)
    }
  })

  it('are plain English when the profile is not an object', () => {
    expect(kioskProfileSchema.safeParse(null).error?.issues[0]?.message).toBe(
      'Fill in your profile.',
    )
  })
})

describe('kioskProfileSchema', () => {
  it('accepts the general fields plus school details, student number uppercased', () => {
    expect(kioskProfileSchema.parse({ ...general, ...school })).toMatchObject({
      studentNumber: 'C23-01-7557-MAN121',
      course: 'BSIT',
      yearLevel: 2,
    })
  })

  it.each(SCHOOL_FIELDS)('requires %s', (field) => {
    const profile: Record<string, unknown> = { ...general, ...school }
    delete profile[field]
    expect(kioskProfileSchema.safeParse(profile).success).toBe(false)
  })

  it('checks the year level against the course', () => {
    const result = kioskProfileSchema.safeParse({
      ...general,
      ...school,
      course: 'HRT',
      yearLevel: 4,
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]).toMatchObject({
      path: ['yearLevel'],
      message: 'HRT only goes up to 3rd year.',
    })
  })

  it('still refuses fields neither profile has', () => {
    expect(kioskProfileSchema.safeParse({ ...general, ...school, email: 'a@b.c' }).success).toBe(
      false,
    )
  })
})
