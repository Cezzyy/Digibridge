import { describe, expect, it } from 'vitest'
import { ONLINE_CONSENT_NOTICE, SCHOOL_CONSENT_NOTICE } from '../consent'
import { SCHOOL_FIELDS } from './school'
import { onlineRespondentSchema, schoolRespondentSchema } from './respondent'

const online = {
  fullName: ' Juan Dela Cruz ',
  birthDate: '2007-06-15',
  sex: 'male',
  devices: ['smartphone'],
  internetAccess: ['mobile_data', 'piso_wifi'],
  showIdentity: false,
  consentVersion: ONLINE_CONSENT_NOTICE.version,
}

const school = { studentNumber: 'C23-01-7557-MAN121', course: 'BSIT', yearLevel: 2 }

describe('onlineRespondentSchema', () => {
  it('accepts the general profile, the identity choice and the consent version', () => {
    expect(onlineRespondentSchema.parse(online)).toEqual({ ...online, fullName: 'Juan Dela Cruz' })
  })

  it.each(SCHOOL_FIELDS)('refuses the school field %s (PRO-06)', (field) => {
    const result = onlineRespondentSchema.safeParse({ ...online, [field]: school[field] })
    expect(result.error?.issues[0]?.message).toBe(
      "Your answers include a question this form doesn't ask.",
    )
  })

  it('needs an explicit identity choice (PRO-05)', () => {
    const { showIdentity: _, ...withoutChoice } = online
    for (const bad of [withoutChoice, { ...online, showIdentity: 'yes' }]) {
      expect(onlineRespondentSchema.safeParse(bad).error?.issues[0]?.message).toBe(
        'Choose whether the DigiBridge team may see your name.',
      )
    }
  })

  it('refuses consent to any notice but the current one (CON-02)', () => {
    for (const bad of [
      { ...online, consentVersion: 'online-0' },
      { ...online, consentVersion: undefined },
    ]) {
      expect(onlineRespondentSchema.safeParse(bad).error?.issues[0]?.message).toContain(
        'privacy notice has changed',
      )
    }
  })
})

describe('schoolRespondentSchema', () => {
  const schoolRespondent = {
    ...online,
    ...school,
    studentNumber: 'c23-01-7557-man121',
    consentVersion: SCHOOL_CONSENT_NOTICE.version,
  }

  it('accepts the school profile, the identity choice and the school notice (LNK-03)', () => {
    expect(schoolRespondentSchema.parse(schoolRespondent)).toEqual({
      ...schoolRespondent,
      fullName: 'Juan Dela Cruz',
      studentNumber: 'C23-01-7557-MAN121',
    })
  })

  it.each(SCHOOL_FIELDS)('requires %s', (field) => {
    const body: Record<string, unknown> = { ...schoolRespondent }
    delete body[field]
    expect(schoolRespondentSchema.safeParse(body).success).toBe(false)
  })

  it('still checks the year level against the course', () => {
    const result = schoolRespondentSchema.safeParse({
      ...schoolRespondent,
      course: 'WADT',
      yearLevel: 4,
    })
    expect(result.error?.issues[0]).toMatchObject({ path: ['yearLevel'] })
  })

  it('asks about the student number too in the identity choice', () => {
    const { showIdentity: _, ...withoutChoice } = schoolRespondent
    expect(schoolRespondentSchema.safeParse(withoutChoice).error?.issues[0]?.message).toBe(
      'Choose whether the DigiBridge team may see your name and student number.',
    )
  })

  it('refuses consent to the online notice', () => {
    const result = schoolRespondentSchema.safeParse({
      ...schoolRespondent,
      consentVersion: ONLINE_CONSENT_NOTICE.version,
    })
    expect(result.error?.issues[0]?.message).toContain('privacy notice has changed')
  })

  it('refuses fields neither profile has', () => {
    expect(schoolRespondentSchema.safeParse({ ...schoolRespondent, code: 'X' }).success).toBe(false)
  })
})
