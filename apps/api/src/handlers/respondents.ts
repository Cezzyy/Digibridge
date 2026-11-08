import { respondents } from '@digibridge/db'
import { BIRTH_DATE_MESSAGES, birthDateRange, todayInPhilippines } from '@digibridge/shared'
import type { RouteHandler } from '@hono/zod-openapi'
import type { AuthEnv } from '../env'
import { ApiError } from '../middleware'
import type { createRespondentRoute } from '../routes/respondents'

export const createRespondent: RouteHandler<typeof createRespondentRoute, AuthEnv> = async (c) => {
  const { consentVersion, ...profile } = c.req.valid('json')

  // The schema checked the age against today when the request came in; the database checks it
  // against the day of consentedAt. Check again on that same day, so a request that crosses
  // midnight in the Philippines gets the 400 instead of a failed insert (a 500).
  const consentedAt = new Date()
  const { earliest, latest } = birthDateRange(todayInPhilippines(consentedAt))
  if (profile.birthDate < earliest || profile.birthDate > latest) {
    throw new ApiError('validation_failed', BIRTH_DATE_MESSAGES.outOfRange)
  }

  // profile_id is unique: a second profile for the same account, even one sent at the same
  // moment, inserts nothing (PRO-07).
  const [created] = await c.var.db
    .insert(respondents)
    .values({
      ...profile,
      profileId: c.var.profile.id,
      mode: 'online',
      consentVersion,
      consentedAt,
    })
    .onConflictDoNothing({ target: respondents.profileId })
    .returning({ id: respondents.id, fullName: respondents.fullName })

  if (!created) throw new ApiError('conflict', 'You already filled in your profile.')
  return c.json(created, 201)
}
