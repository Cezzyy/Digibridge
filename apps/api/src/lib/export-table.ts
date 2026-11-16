import {
  AGE_GROUP_LABELS,
  ageGroupFor,
  AREA_CODES,
  AREA_LABELS,
  AREA_MAX_POINTS,
  DEVICE_LABELS,
  DEVICES,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  EXPORT_AREA_CODES,
  EXPORT_DIFFICULTY_CODES,
  exportItemCode,
  HIDDEN_IDENTITY,
  INTERNET_ACCESS,
  INTERNET_ACCESS_LABELS,
  LEVEL_CUTOFFS,
  LEVEL_LABELS,
  MODE_LABELS,
  OVERALL_MAX_POINTS,
  POINTS_PER_DIFFICULTY,
  RESPONDENT_SORT_LABELS,
  RESPONDENT_STATUS_LABELS,
  SEX_LABELS,
  SUS_ANSWER_LABELS,
  SUS_ANSWER_MAX,
  SUS_ANSWER_MIN,
  SUS_STATEMENTS,
  VOID_REASON_LABELS,
  YEAR_LEVEL_LABELS,
  type AreaCode,
  type AttemptStatus,
  type Difficulty,
  type ExportQuery,
  type Level,
  type Mode,
  type RespondentStatus,
  type Sex,
  type VoidReason,
  type YearLevel,
} from '@digibridge/shared'
import type { Cell, Column, Sheet } from './sheet'

// The export's sheets (DSH-06), from rows the handler reads: one row per respondent with their
// profile, attempt, scores, SUS answers and a 0/1 column per question; the questions behind those
// columns; and a codebook that explains every column and how the file was made. Scores, SUS and
// item marks are filled for finished attempts only, as on the dashboard. Hidden names and student
// numbers read Hidden (PRO-05); school cells are empty for online respondents.

export type ExportRespondent = {
  id: string
  mode: Mode
  fullName: string
  studentNumber: string | null
  showIdentity: boolean
  school: string | null
  linkLabel: string | null
  linkCode: string | null
  course: string | null
  yearLevel: number | null
  sex: Sex
  age: number
  devices: string[]
  internetAccess: string[]
  consentVersion: string
  consentedAt: Date
  status: RespondentStatus
  attemptId: string | null
  attemptStatus: AttemptStatus | null
  startedAt: Date | null
  submittedAt: Date | null
  voidReason: VoidReason | null
  voidedAt: Date | null
  totalPoints: number | null
  overallPct: number | null
  overallLevel: Level | null
  /** The items their attempt showed, in order. */
  questionOrder: string[] | null
}

export type ExportAreaResult = {
  attemptId: string
  area: AreaCode
  points: number
  pct: number
  level: Level
}

export type ExportSus = { attemptId: string; score: number; answers: number[] }

/** An answer saved on a finished attempt, and whether its choice is the right one. */
export type ExportMark = { attemptId: string; questionId: string; correct: boolean }

/** Every question, in the order item analysis lists them: area, difficulty, then as written. */
export type ExportQuestion = {
  id: string
  area: AreaCode
  difficulty: Difficulty
  stem: string
  isActive: boolean
}

export type ExportData = {
  respondents: ExportRespondent[]
  areas: ExportAreaResult[]
  sus: ExportSus[]
  marks: ExportMark[]
  questions: ExportQuestion[]
  query: ExportQuery
  /** The school link filter's label, when it's set. */
  linkLabel: string | null
  exportedAt: Date
}

/** A respondent with their finished attempt's results, for working out each cell. */
type Row = ExportRespondent & {
  finished: boolean
  areas: Map<AreaCode, ExportAreaResult>
  sus: ExportSus | null
  marks: Map<string, boolean>
}

/** A column of the respondents sheet: its cell for each row. */
type ValueColumn = Column & { value: (row: Row) => Cell }
/** One the codebook explains. */
type RespondentColumn = ValueColumn & { description: string }

const yesNo = (value: boolean) => (value ? 'Yes' : 'No')
const label = <K extends string>(labels: Record<K, string>, value: K | null) =>
  value === null ? null : labels[value]
const secondsBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / 1000)

const PROFILE_COLUMNS: RespondentColumn[] = [
  {
    header: 'Respondent ID',
    width: 38,
    description: 'The respondent’s ID in DigiBridge. Stays the same in every export.',
    value: (r) => r.id,
  },
  {
    header: 'Mode',
    description: `How they took part: ${MODE_LABELS.online} (Google sign-in) or ${MODE_LABELS.school}.`,
    value: (r) => MODE_LABELS[r.mode],
  },
  {
    header: 'Name',
    width: 28,
    description: `Full name, or ${HIDDEN_IDENTITY} when they chose not to show who they are.`,
    value: (r) => (r.showIdentity ? r.fullName : HIDDEN_IDENTITY),
  },
  {
    header: 'Student number',
    width: 22,
    description: `School links only; ${HIDDEN_IDENTITY} when they chose not to show who they are. Empty online.`,
    value: (r) =>
      r.mode === 'school' ? (r.showIdentity ? r.studentNumber : HIDDEN_IDENTITY) : null,
  },
  {
    header: 'Identity shown',
    description: 'Yes when they let the team see their name (and student number).',
    value: (r) => yesNo(r.showIdentity),
  },
  {
    header: 'School',
    width: 24,
    description: 'The school of the link they joined through. Empty online.',
    value: (r) => r.school,
  },
  {
    header: 'School link',
    width: 24,
    description: 'The name of the link they joined through. Empty online.',
    value: (r) => r.linkLabel,
  },
  {
    header: 'Link code',
    width: 14,
    description: 'The code in the link’s address (/s/<code>). Empty online.',
    value: (r) => r.linkCode,
  },
  {
    header: 'Course',
    description: 'School links only. Empty online.',
    value: (r) => r.course,
  },
  {
    header: 'Year level',
    description: 'School links only, from 1 to 4. Empty online.',
    value: (r) => r.yearLevel,
  },
  {
    header: 'Sex',
    description: `${Object.values(SEX_LABELS).join(', ')}.`,
    value: (r) => SEX_LABELS[r.sex],
  },
  {
    header: 'Age',
    description: 'Age in whole years on the day they agreed to the notice.',
    value: (r) => r.age,
  },
  {
    header: 'Age group',
    description: `The dashboard’s age group: ${Object.values(AGE_GROUP_LABELS).join(', ')}.`,
    value: (r) => AGE_GROUP_LABELS[ageGroupFor(r.age)],
  },
  ...DEVICES.map((device): RespondentColumn => ({
    header: `Device: ${DEVICE_LABELS[device]}`,
    description: `1 if they picked ${DEVICE_LABELS[device]} among the devices they own, else 0.`,
    value: (r) => (r.devices.includes(device) ? 1 : 0),
  })),
  ...INTERNET_ACCESS.map((access): RespondentColumn => ({
    header: `Internet: ${INTERNET_ACCESS_LABELS[access]}`,
    description: `1 if they picked ${INTERNET_ACCESS_LABELS[access]} among the ways they get internet, else 0.`,
    value: (r) => (r.internetAccess.includes(access) ? 1 : 0),
  })),
  {
    header: 'Notice version',
    description: 'The version of the privacy notice they agreed to.',
    value: (r) => r.consentVersion,
  },
  {
    header: 'Consented at',
    width: 20,
    description: 'When they agreed to the notice and saved their profile.',
    value: (r) => r.consentedAt,
  },
]

const ATTEMPT_COLUMNS: RespondentColumn[] = [
  {
    header: 'Status',
    description: `${Object.values(RESPONDENT_STATUS_LABELS).join(', ')}. Scores, SUS and question columns are filled for Finished only.`,
    value: (r) => RESPONDENT_STATUS_LABELS[r.status],
  },
  {
    header: 'Started at',
    width: 20,
    description: 'When their assessment started. For a voided one, when that attempt started.',
    value: (r) => r.startedAt,
  },
  {
    header: 'Submitted at',
    width: 20,
    description: 'When they submitted, or when the timer closed it.',
    value: (r) => (r.finished ? r.submittedAt : null),
  },
  {
    header: 'Closed by timer',
    description: 'Yes when time ran out before they submitted. Finished only.',
    value: (r) => (r.finished ? yesNo(r.attemptStatus === 'expired') : null),
  },
  {
    header: 'Time taken (seconds)',
    description: 'From start to submit, or to when the timer closed it. Finished only.',
    value: (r) =>
      r.finished && r.startedAt && r.submittedAt
        ? secondsBetween(r.startedAt, r.submittedAt)
        : null,
  },
  {
    header: 'Void reason',
    width: 26,
    description: 'Why an admin voided their attempt. Voided only.',
    value: (r) => label(VOID_REASON_LABELS, r.voidReason),
  },
  {
    header: 'Voided at',
    width: 20,
    description: 'When an admin voided their attempt. Voided only.',
    value: (r) => r.voidedAt,
  },
]

const SCORE_COLUMNS: RespondentColumn[] = [
  {
    header: 'Overall points',
    description: `Points across the 3 areas, out of ${OVERALL_MAX_POINTS}.`,
    value: (r) => (r.finished ? r.totalPoints : null),
  },
  {
    header: 'Overall %',
    description: 'Overall points as a percentage, from 0 to 100.',
    value: (r) => (r.finished ? r.overallPct : null),
  },
  {
    header: 'Overall level',
    description: `The level for the overall percentage: ${Object.values(LEVEL_LABELS).join(', ')}.`,
    value: (r) => (r.finished ? label(LEVEL_LABELS, r.overallLevel) : null),
  },
  ...AREA_CODES.flatMap((area): RespondentColumn[] => [
    {
      header: `${AREA_LABELS[area]} points`,
      description: `Points in ${AREA_LABELS[area]}, out of ${AREA_MAX_POINTS}.`,
      value: (r) => r.areas.get(area)?.points ?? null,
    },
    {
      header: `${AREA_LABELS[area]} %`,
      description: `Points in ${AREA_LABELS[area]} as a percentage, from 0 to 100.`,
      value: (r) => r.areas.get(area)?.pct ?? null,
    },
    {
      header: `${AREA_LABELS[area]} level`,
      description: `The level for the ${AREA_LABELS[area]} percentage.`,
      value: (r) => label(LEVEL_LABELS, r.areas.get(area)?.level ?? null),
    },
  ]),
]

const SUS_COLUMNS: RespondentColumn[] = [
  {
    header: 'SUS score',
    description:
      'System Usability Scale score, from 0 to 100, when they answered it. Finished only.',
    value: (r) => r.sus?.score ?? null,
  },
  ...SUS_STATEMENTS.map((statement, i): RespondentColumn => ({
    header: `SUS ${i + 1}`,
    description: `“${statement}” From ${SUS_ANSWER_MIN} (${SUS_ANSWER_LABELS[0]}) to ${SUS_ANSWER_MAX} (${SUS_ANSWER_LABELS.at(-1)}).`,
    value: (r) => r.sus?.answers[i] ?? null,
  })),
]

/** Each question's column name: numbered in its area and difficulty, in the order given. */
function itemCodes(questions: ExportQuestion[]) {
  const counts = new Map<string, number>()
  return new Map(
    questions.map((q) => {
      const key = `${q.area}:${q.difficulty}`
      const n = (counts.get(key) ?? 0) + 1
      counts.set(key, n)
      return [q.id, exportItemCode(q.area, q.difficulty, n)]
    }),
  )
}

const pctRange = (min: number, below?: number) =>
  below === undefined
    ? `${min}% and up`
    : min === 0
      ? `under ${below}%`
      : `${min}% to under ${below}%`

/** The filters, status and search in words, or None. */
function filtersInWords({ query, linkLabel }: ExportData) {
  const parts = [
    query.sex && `Sex: ${SEX_LABELS[query.sex]}`,
    query.ageGroup && `Age group: ${AGE_GROUP_LABELS[query.ageGroup]}`,
    query.device && `Device: ${DEVICE_LABELS[query.device]}`,
    query.internetAccess && `Internet: ${INTERNET_ACCESS_LABELS[query.internetAccess]}`,
    query.mode && `Mode: ${MODE_LABELS[query.mode]}`,
    query.schoolLinkId && `School link: ${linkLabel ?? query.schoolLinkId}`,
    query.course && `Course: ${query.course}`,
    query.yearLevel !== undefined &&
      `Year level: ${YEAR_LEVEL_LABELS[query.yearLevel as YearLevel]}`,
    query.from && `Consented from: ${query.from}`,
    query.to && `Consented to: ${query.to}`,
    query.status && `Status: ${RESPONDENT_STATUS_LABELS[query.status]}`,
    query.q && `Search: “${query.q}”`,
  ].filter((part): part is string => !!part)
  return parts.length ? parts.join('; ') : 'None'
}

export function buildExport(data: ExportData): Sheet[] {
  const codes = itemCodes(data.questions)
  const areasBy = new Map<string, Map<AreaCode, ExportAreaResult>>()
  for (const result of data.areas) {
    const areas = areasBy.get(result.attemptId) ?? new Map<AreaCode, ExportAreaResult>()
    areas.set(result.area, result)
    areasBy.set(result.attemptId, areas)
  }
  const susBy = new Map(data.sus.map((sus) => [sus.attemptId, sus]))
  const marksBy = new Map<string, Map<string, boolean>>()
  for (const mark of data.marks) {
    const marks = marksBy.get(mark.attemptId) ?? new Map<string, boolean>()
    marks.set(mark.questionId, mark.correct)
    marksBy.set(mark.attemptId, marks)
  }

  const rows: Row[] = data.respondents.map((r) => {
    const finished = r.status === 'finished' && r.attemptId !== null
    const attemptId = finished ? r.attemptId! : ''
    return {
      ...r,
      finished,
      areas: areasBy.get(attemptId) ?? new Map(),
      sus: susBy.get(attemptId) ?? null,
      marks: marksBy.get(attemptId) ?? new Map(),
    }
  })

  // A column for each question a finished attempt in the file showed.
  const shown = new Set(rows.flatMap((r) => (r.finished ? (r.questionOrder ?? []) : [])))
  const shownQuestions = data.questions.filter((q) => shown.has(q.id))
  const itemColumns = shownQuestions.map((q): ValueColumn => ({
    header: codes.get(q.id)!,
    value: (r) =>
      r.finished && r.questionOrder?.includes(q.id) ? (r.marks.get(q.id) ? 1 : 0) : null,
  }))

  const described = [...PROFILE_COLUMNS, ...ATTEMPT_COLUMNS, ...SCORE_COLUMNS, ...SUS_COLUMNS]
  const columns: ValueColumn[] = [...described, ...itemColumns]

  const respondentsSheet: Sheet = {
    name: 'Respondents',
    columns,
    rows: rows.map((row) => columns.map((column) => column.value(row))),
  }

  const questionsSheet: Sheet = {
    name: 'Questions',
    columns: [
      { header: 'Code' },
      { header: 'Area', width: 32 },
      { header: 'Difficulty', width: 12 },
      { header: 'Points' },
      { header: 'Active' },
      { header: 'Question ID', width: 38 },
      { header: 'Question', width: 60, wrap: true },
    ],
    rows: shownQuestions.map((q) => [
      codes.get(q.id)!,
      AREA_LABELS[q.area],
      DIFFICULTY_LABELS[q.difficulty],
      POINTS_PER_DIFFICULTY[q.difficulty],
      yesNo(q.isActive),
      q.id,
      q.stem,
    ]),
  }

  const cutoffs = LEVEL_CUTOFFS.map(
    (cutoff, i) =>
      `${LEVEL_LABELS[cutoff.level]}: ${pctRange(cutoff.min, LEVEL_CUTOFFS[i - 1]?.min)}`,
  )
  const firstCode = exportItemCode(AREA_CODES[0], DIFFICULTIES[0], 1)
  const codebookSheet: Sheet = {
    name: 'Codebook',
    columns: [
      { header: 'Column', width: 34, wrap: true },
      { header: 'What it means', width: 60, wrap: true },
    ],
    rows: [
      ...described.map((column): Cell[] => [column.header, column.description]),
      [
        `Question columns (${firstCode}, …)`,
        `One per question shown in a finished assessment in this file, named by area (${AREA_CODES.map((a) => `${EXPORT_AREA_CODES[a]} ${AREA_LABELS[a]}`).join(', ')}), difficulty (${DIFFICULTIES.map((d) => `${EXPORT_DIFFICULTY_CODES[d]} ${DIFFICULTY_LABELS[d]}`).join(', ')}) and number. 1 = answered right; 0 = answered wrong or left blank, as scored; empty = not in their assessment. The Questions sheet has each one’s text.`,
      ],
      [null, null],
      ['Exported at', data.exportedAt],
      ['Respondents', data.respondents.length],
      ['Filters', filtersInWords(data)],
      ['Order', RESPONDENT_SORT_LABELS[data.query.sort]],
      ['Times', 'Every date and time is Philippine time (UTC+8).'],
      ['Levels', `${cutoffs.join('; ')}. The same cut-offs apply to each area and overall.`],
      [
        'Points',
        `${DIFFICULTIES.map((d) => `${DIFFICULTY_LABELS[d]} ${POINTS_PER_DIFFICULTY[d]}`).join(', ')} per right answer; ${AREA_MAX_POINTS} per area, ${OVERALL_MAX_POINTS} in all.`,
      ],
    ],
  }

  return [respondentsSheet, questionsSheet, codebookSheet]
}
