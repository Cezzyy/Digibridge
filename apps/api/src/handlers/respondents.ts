import { respondents } from '@digibridge/db'
import type { RouteHandler } from '@hono/zod-openapi'
import type { AuthEnv } from '../env'
import { ApiError } from '../middleware'
import type { createRespondentRoute } from '../routes/respondents'

export const createRespondent: RouteHandler<typeof createRespondentRoute, AuthEnv> = async (c) => {
  const { consentVersion, ...profile } = c.req.valid('json')

  // profile_id is unique: a second profile for the same account, even one sent at the same
  // moment, inserts nothing (PRO-07).
  const [created] = await c.var.db
    .insert(respondents)
    .values({
      ...profile,
      profileId: c.var.profile.id,
      mode: 'online',
      consentVersion,
      consentedAt: new Date(),
    })
    .onConflictDoNothing({ target: respondents.profileId })
    .returning({ id: respondents.id, fullName: respondents.fullName })

  if (!created) throw new ApiError('conflict', 'You already filled in your profile.')
  return c.json(created, 201)
}
