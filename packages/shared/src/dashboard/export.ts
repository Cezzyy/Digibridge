import type { z } from 'zod'
import type { AreaCode } from '../assessment/rules'
import type { Difficulty } from '../enums'
import { respondentListQuerySchema } from './respondents'

// Exporting the respondents for analysis (DSH-06), admin only: the rows the respondents table
// shows (the dashboard filters, status, search and sort, every page), as CSV or as an Excel
// workbook that adds a sheet of questions and a codebook.

export const EXPORT_FORMATS = ['csv', 'xlsx'] as const
export type ExportFormat = (typeof EXPORT_FORMATS)[number]

export const EXPORT_FORMAT_LABELS = {
  csv: 'CSV',
  xlsx: 'Excel',
} as const satisfies Record<ExportFormat, string>

/** The respondents table's query without the page: the export has every page. */
export const exportQuerySchema = respondentListQuerySchema.omit({ page: true })
export type ExportQuery = z.infer<typeof exportQuerySchema>

/** The file's name, with the day it was made (in the Philippines). */
export const exportFileName = (format: ExportFormat, day: string) =>
  `digibridge-respondents-${day}.${format}`

/**
 * Item columns are named by area, difficulty and number, like INF-B01: the questions of each
 * area and difficulty are numbered in the order they were written.
 */
export const EXPORT_AREA_CODES = {
  info_literacy: 'INF',
  communication: 'COM',
  safety: 'SAF',
} as const satisfies Record<AreaCode, string>

export const EXPORT_DIFFICULTY_CODES = {
  basic: 'B',
  intermediate: 'I',
  advanced: 'A',
} as const satisfies Record<Difficulty, string>

/** A question's column name: its area, difficulty and number (from 1). */
export const exportItemCode = (area: AreaCode, difficulty: Difficulty, number: number) =>
  `${EXPORT_AREA_CODES[area]}-${EXPORT_DIFFICULTY_CODES[difficulty]}${String(number).padStart(2, '0')}`
