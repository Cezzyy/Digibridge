import { respondents } from '@digibridge/db'
import { BIRTH_DATE_MESSAGES, birthDateRange, todayInPhilippines } from '@digibridge/shared'
import { eq } from 'drizzle-orm'
import type { RespondentKey } from '../env'
import { ApiError } from '../middleware/error'

/** The respondent a key points at: by Google account online, by token hash through a link. */
export const respondentIs = (key: RespondentKey) =>
  'profileId' in key
    ? eq(respondents.profileId, key.profileId)
    : eq(respondents.accessTokenHash, key.tokenHash)

/**
 * The schema checked the age against today when the request came in; the database checks it
 * against the day of `consentedAt`. Checking again on that same day means a request that crosses
 * midnight in the Philippines gets a 400 instead of a failed insert (a 500).
 */
export function checkAgeOnConsentDay(birthDate: string, consentedAt: Date) {
  const { earliest, latest } = birthDateRange(todayInPhilippines(consentedAt))
  if (birthDate < earliest || birthDate > latest) {
    throw new ApiError('validation_failed', BIRTH_DATE_MESSAGES.outOfRange)
  }
}
