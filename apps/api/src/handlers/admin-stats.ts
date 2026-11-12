import {
  areaResults,
  attempts,
  competencyAreas,
  respondents,
  schoolLinks,
  susResponses,
} from '@digibridge/db'
import { FINISHED_ATTEMPT_STATUSES, type AreaCode } from '@digibridge/shared'
import type { RouteHandler } from '@hono/zod-openapi'
import { and, count, eq, inArray, sql } from 'drizzle-orm'
import type { AuthEnv } from '../env'
import { ageAtConsent, currentAttempts, dashboardConditions } from '../lib/dashboard-filters'
import { buildStats } from '../lib/stats'
import type { statsRoute } from '../routes/admin-stats'

export const getStats: RouteHandler<typeof statsRoute, AuthEnv> = async (c) => {
  const { groupBy, ...filters } = c.req.valid('query')
  const db = c.var.db

  // Respondents who match, finished or not, filtered by their current attempt's link.
  const current = currentAttempts(db)
  const counting = db
    .select({ total: count() })
    .from(respondents)
    .leftJoin(current, eq(current.respondentId, respondents.id))
    .where(and(...dashboardConditions(filters, current.schoolLinkId)))

  // The finished attempts of respondents who match. One per respondent: the others are voided.
  const finishedWhere = and(
    inArray(attempts.status, FINISHED_ATTEMPT_STATUSES),
    ...dashboardConditions(filters, attempts.schoolLinkId),
  )
  const finishedAttempts = db
    .select({ id: attempts.id })
    .from(attempts)
    .innerJoin(respondents, eq(respondents.id, attempts.respondentId))
    .where(finishedWhere)

  const [[counted], finished, areas, sus] = await Promise.all([
    counting,
    db
      .select({
        attemptId: attempts.id,
        mode: respondents.mode,
        sex: respondents.sex,
        age: ageAtConsent,
        devices: respondents.devices,
        internetAccess: respondents.internetAccess,
        course: respondents.course,
        yearLevel: respondents.yearLevel,
        linkId: schoolLinks.id,
        linkLabel: schoolLinks.label,
        overallPct: attempts.overallPct,
        overallLevel: attempts.overallLevel,
        timeTakenSeconds: sql<number>`extract(epoch from ${attempts.submittedAt} - ${attempts.startedAt})::float8`,
      })
      .from(attempts)
      .innerJoin(respondents, eq(respondents.id, attempts.respondentId))
      .leftJoin(schoolLinks, eq(schoolLinks.id, attempts.schoolLinkId))
      .where(finishedWhere),
    db
      .select({
        attemptId: areaResults.attemptId,
        area: competencyAreas.code,
        pct: areaResults.pct,
        level: areaResults.level,
      })
      .from(areaResults)
      .innerJoin(competencyAreas, eq(competencyAreas.id, areaResults.areaId))
      .where(inArray(areaResults.attemptId, finishedAttempts)),
    db.select().from(susResponses).where(inArray(susResponses.attemptId, finishedAttempts)),
  ])

  const stats = buildStats(
    {
      respondents: counted?.total ?? 0,
      // Submit and the cron always score before closing, so a finished attempt has its scores.
      finished: finished.flatMap((row) =>
        row.overallPct === null || row.overallLevel === null
          ? []
          : [{ ...row, overallPct: row.overallPct, overallLevel: row.overallLevel }],
      ),
      // Area codes are the seeded AREA_CODES.
      areas: areas.map((row) => ({ ...row, area: row.area as AreaCode })),
      sus: sus.map((row) => ({
        score: row.score,
        answers: [row.q1, row.q2, row.q3, row.q4, row.q5, row.q6, row.q7, row.q8, row.q9, row.q10],
      })),
    },
    groupBy,
  )
  return c.json(stats, 200)
}
