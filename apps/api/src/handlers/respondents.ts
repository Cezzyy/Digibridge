import { respondents } from '@digibridge/db'
import type { RouteHandler } from '@hono/zod-openapi'
import type { AuthEnv } from '../env'
import { checkAgeOnConsentDay } from '../lib/respondent'
import { ApiError } from '../middleware'
import type { createRespondentRoute } from '../routes/respondents'

export const createRespondent: RouteHandler<typeof createRespondentRoute, AuthEnv> = async (c) => {
  const { consentVersion, ...profile } = c.req.valid('json')

  const consentedAt = new Date()
  checkAgeOnConsentDay(profile.birthDate, consentedAt)

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
