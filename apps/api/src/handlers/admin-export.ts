import {
  answers,
  areaResults,
  choices,
  competencyAreas,
  questions,
  respondents,
  schoolLinks,
  susResponses,
} from '@digibridge/db'
import {
  exportFileName,
  FINISHED_ATTEMPT_STATUSES,
  todayInPhilippines,
  type AreaCode,
  type ExportFormat,
  type ExportQuery,
} from '@digibridge/shared'
import type { RouteHandler } from '@hono/zod-openapi'
import { and, eq, inArray } from 'drizzle-orm'
import type { Db } from '../config/db'
import type { AuthEnv } from '../env'
import { toCsv } from '../lib/csv'
import { ageAtConsent, currentAttempts } from '../lib/dashboard-filters'
import { buildExport } from '../lib/export-table'
import {
  finishedScore,
  respondentConditions,
  respondentOrder,
  statusOf,
} from '../lib/respondent-list'
import { toXlsx, XLSX_TYPE } from '../lib/xlsx'
import type { exportCsvRoute, exportXlsxRoute } from '../routes/admin-export'

/**
 * Everything the export needs, in one round of queries: the respondents with their attempt, and
 * the area results, SUS answers and answer marks of their finished attempts, picked by the same
 * conditions in a subquery so nothing waits on the respondents' rows. They share one snapshot
 * (a read-only repeatable read transaction), so a submit committing midway can't give a finished
 * row without its area results and marks.
 */
async function readExport(db: Db, query: ExportQuery) {
  const current = currentAttempts(db)
  const where = and(...respondentConditions(query, current))
  const finishedIds = db
    .select({ id: current.id })
    .from(respondents)
    .innerJoin(current, eq(current.respondentId, respondents.id))
    .where(and(where, inArray(current.status, FINISHED_ATTEMPT_STATUSES)))

  const [rows, areas, sus, marks, bank, [link]] = await db.transaction(
    (tx) =>
      Promise.all([
        tx
          .select({
            id: respondents.id,
            mode: respondents.mode,
            fullName: respondents.fullName,
            studentNumber: respondents.studentNumber,
            showIdentity: respondents.showIdentity,
            school: schoolLinks.school,
            linkLabel: schoolLinks.label,
            linkCode: schoolLinks.code,
            course: respondents.course,
            yearLevel: respondents.yearLevel,
            sex: respondents.sex,
            age: ageAtConsent,
            devices: respondents.devices,
            internetAccess: respondents.internetAccess,
            consentVersion: respondents.consentVersion,
            consentedAt: respondents.consentedAt,
            status: statusOf(current),
            attemptId: current.id,
            attemptStatus: current.status,
            startedAt: current.startedAt,
            submittedAt: current.submittedAt,
            voidReason: current.voidReasonCode,
            voidedAt: current.voidedAt,
            totalPoints: current.totalPoints,
            overallPct: finishedScore(current).pct,
            overallLevel: finishedScore(current).level,
            questionOrder: current.questionOrder,
          })
          .from(respondents)
          .leftJoin(current, eq(current.respondentId, respondents.id))
          .leftJoin(schoolLinks, eq(schoolLinks.id, respondents.schoolLinkId))
          .where(where)
          .orderBy(...respondentOrder(query.sort, current)),
        tx
          .select({
            attemptId: areaResults.attemptId,
            area: competencyAreas.code,
            points: areaResults.points,
            pct: areaResults.pct,
            level: areaResults.level,
          })
          .from(areaResults)
          .innerJoin(competencyAreas, eq(competencyAreas.id, areaResults.areaId))
          .where(inArray(areaResults.attemptId, finishedIds)),
        tx.select().from(susResponses).where(inArray(susResponses.attemptId, finishedIds)),
        tx
          .select({
            attemptId: answers.attemptId,
            questionId: answers.questionId,
            correct: choices.isCorrect,
          })
          .from(answers)
          .innerJoin(choices, eq(choices.id, answers.choiceId))
          .where(inArray(answers.attemptId, finishedIds)),
        tx
          .select({
            id: questions.id,
            area: competencyAreas.code,
            difficulty: questions.difficulty,
            itemNumber: questions.itemNumber,
            stem: questions.stem,
            isActive: questions.isActive,
          })
          .from(questions)
          .innerJoin(competencyAreas, eq(competencyAreas.id, questions.areaId))
          // As item analysis lists them; the difficulty enum is in order: basic, intermediate, advanced.
          .orderBy(competencyAreas.sortOrder, questions.difficulty, questions.itemNumber),
        query.schoolLinkId
          ? tx
              .select({ label: schoolLinks.label })
              .from(schoolLinks)
              .where(eq(schoolLinks.id, query.schoolLinkId))
          : [],
      ]),
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )

  return buildExport({
    respondents: rows,
    // Area codes are the seeded AREA_CODES.
    areas: areas.map((row) => ({ ...row, area: row.area as AreaCode })),
    sus: sus.map((row) => ({
      attemptId: row.attemptId,
      score: row.score,
      answers: [row.q1, row.q2, row.q3, row.q4, row.q5, row.q6, row.q7, row.q8, row.q9, row.q10],
    })),
    marks,
    questions: bank.map((row) => ({ ...row, area: row.area as AreaCode })),
    query,
    linkLabel: link?.label ?? null,
    exportedAt: new Date(),
  })
}

/** Saved under the day's name, never shown in the browser, never cached. */
const download = (format: ExportFormat) => ({
  'Content-Disposition': `attachment; filename="${exportFileName(format, todayInPhilippines())}"`,
  'Cache-Control': 'no-store',
})

export const exportCsv: RouteHandler<typeof exportCsvRoute, AuthEnv> = async (c) => {
  const [respondentsSheet] = await readExport(c.var.db, c.req.valid('query'))
  return c.body(toCsv(respondentsSheet!), 200, {
    ...download('csv'),
    'Content-Type': 'text/csv; charset=utf-8',
  })
}

export const exportXlsx: RouteHandler<typeof exportXlsxRoute, AuthEnv> = async (c) => {
  const sheets = await readExport(c.var.db, c.req.valid('query'))
  return c.body(toXlsx(sheets), 200, { ...download('xlsx'), 'Content-Type': XLSX_TYPE })
}
