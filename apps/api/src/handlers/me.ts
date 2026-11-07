import { attempts, respondents } from '@digibridge/db'
import type { RouteHandler } from '@hono/zod-openapi'
import { and, eq, ne } from 'drizzle-orm'
import type { AuthEnv } from '../env'
import type { meRoute } from '../routes/me'

export const getMe: RouteHandler<typeof meRoute, AuthEnv> = async (c) => {
  const { id, email, fullName, avatarUrl, role } = c.var.profile

  // At most one row: one respondent per profile, one non-voided attempt per respondent.
  const [row] = await c.var.db
    .select({
      respondent: { id: respondents.id, fullName: respondents.fullName },
      attemptId: attempts.id,
      attemptStatus: attempts.status,
    })
    .from(respondents)
    .leftJoin(
      attempts,
      and(eq(attempts.respondentId, respondents.id), ne(attempts.status, 'voided')),
    )
    .where(eq(respondents.profileId, id))

  return c.json(
    {
      profile: { id, email, fullName, avatarUrl, role },
      respondent: row?.respondent ?? null,
      attempt:
        row?.attemptId && row.attemptStatus
          ? { id: row.attemptId, status: row.attemptStatus }
          : null,
    },
    200,
  )
}
