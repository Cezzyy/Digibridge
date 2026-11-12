import { z } from 'zod'
import { ONLINE_CONSENT_NOTICE, SCHOOL_CONSENT_NOTICE } from '../consent'
import { generalProfileSchema } from './general'
import { schoolProfileSchema } from './school'

// What a respondent sends to start: consent, profile and the show-identity choice, saved
// together so declining stores nothing (CON-02, PRO-05).

/** True lets the team see the respondent's name (and, through a school link, student number). */
export const showIdentitySchema = z.boolean({
  error: 'Choose whether the DigiBridge team may see your name.',
})

const NOTICE_CHANGED = 'The privacy notice has changed. Please reload the page and read it again.'

/**
 * Online: the general profile only. Still strict, so school fields are refused (PRO-06).
 * `consentVersion` must be the notice the API knows, so a page left open on an old notice
 * can't save consent to text the respondent never saw.
 */
export const onlineRespondentSchema = generalProfileSchema.extend({
  showIdentity: showIdentitySchema,
  consentVersion: z.literal(ONLINE_CONSENT_NOTICE.version, { error: NOTICE_CHANGED }),
})
export type OnlineRespondentInput = z.input<typeof onlineRespondentSchema>
export type OnlineRespondent = z.output<typeof onlineRespondentSchema>

/**
 * Through a school link: the school profile (the general one plus student number, course and
 * year level, LNK-03), the identity choice, which covers the student number too, and consent to
 * the school notice. The link's own course and year-level lock is checked with `linkLockIssues`.
 */
export const schoolRespondentSchema = schoolProfileSchema.safeExtend({
  showIdentity: z.boolean({
    error: 'Choose whether the DigiBridge team may see your name and student number.',
  }),
  consentVersion: z.literal(SCHOOL_CONSENT_NOTICE.version, { error: NOTICE_CHANGED }),
})
export type SchoolRespondentInput = z.input<typeof schoolRespondentSchema>
export type SchoolRespondent = z.output<typeof schoolRespondentSchema>
