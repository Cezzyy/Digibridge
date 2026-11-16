import { exportQuerySchema } from '@digibridge/shared'
import { createRoute, z } from '@hono/zod-openapi'
import { XLSX_TYPE } from '../lib/xlsx'
import { auth, requireRole } from '../middleware'
import { errorResponse } from '../openapi'
import { ADMIN_ERRORS } from './admin'

// Downloading the respondents for analysis (DSH-06), admin only: the respondents table's rows
// (its filters, status, search and sort, every page) with profile, attempt, scores per area,
// SUS answers and a 0/1 column per question. Hidden names and student numbers read Hidden.

const DESCRIPTION =
  'The respondents the table shows for the same query (the dashboard filters, status, search and sort), every page: profile with a 0/1 column per device and way of getting internet, the school link, attempt status and times, overall and per-area points, percentage and level, the SUS score and its 10 answers, and a column per question shown (1 right, 0 wrong or blank, empty if not shown). Scores, SUS and questions are filled for finished attempts only. A respondent who chose not to show who they are has Hidden for name and student number (PRO-05). Admin only (DSH-06).'

const exportRoute = <F extends 'csv' | 'xlsx'>(format: F, type: string, summary: string) =>
  createRoute({
    method: 'get',
    path: `/admin/export.${format}` as `/admin/export.${F}`,
    tags: ['Admin'],
    summary,
    description: DESCRIPTION,
    middleware: [auth, requireRole('admin')] as const,
    security: [{ Bearer: [] }],
    request: { query: exportQuerySchema },
    responses: {
      200: {
        description: 'The file, as an attachment',
        content: { [type]: { schema: z.string().openapi({ format: 'binary' }) } },
      },
      400: errorResponse('A filter, the status or the sort is not valid'),
      ...ADMIN_ERRORS,
    },
  })

export const exportCsvRoute = exportRoute(
  'csv',
  'text/csv; charset=utf-8',
  'The respondents as CSV',
)

export const exportXlsxRoute = exportRoute(
  'xlsx',
  XLSX_TYPE,
  'The respondents as an Excel workbook, with a questions sheet and a codebook',
)
