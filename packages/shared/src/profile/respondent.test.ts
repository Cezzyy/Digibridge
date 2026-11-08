import { describe, expect, it } from 'vitest'
import { ONLINE_CONSENT_NOTICE } from '../consent'
import { SCHOOL_FIELDS } from './kiosk'
import { onlineRespondentSchema } from './respondent'

const online = {
  fullName: ' Juan Dela Cruz ',
  age: 19,
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
