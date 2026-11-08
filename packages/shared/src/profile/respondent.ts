import { z } from 'zod'
import { ONLINE_CONSENT_NOTICE } from '../consent'
import { generalProfileSchema } from './general'

// What a respondent sends to start: consent, profile and the show-identity choice, saved
// together so declining stores nothing (CON-02, PRO-05).

/** True lets the team see the respondent's name (and, in kiosk mode, student number). */
export const showIdentitySchema = z.boolean({
  error: 'Choose whether the research team may see your name.',
})

/**
 * Online: the general profile only. Still strict, so school fields are refused (PRO-06).
 * `consentVersion` must be the notice the API knows, so a page left open on an old notice
 * can't save consent to text the respondent never saw.
 */
export const onlineRespondentSchema = generalProfileSchema.extend({
  showIdentity: showIdentitySchema,
  consentVersion: z.literal(ONLINE_CONSENT_NOTICE.version, {
    error: 'The privacy notice has changed. Please reload the page and read it again.',
  }),
})
export type OnlineRespondentInput = z.input<typeof onlineRespondentSchema>
export type OnlineRespondent = z.output<typeof onlineRespondentSchema>
