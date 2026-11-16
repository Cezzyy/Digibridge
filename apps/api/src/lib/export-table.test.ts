import { AREA_LABELS, HIDDEN_IDENTITY } from '@digibridge/shared'
import { describe, expect, it } from 'vitest'
import { buildExport, type ExportData, type ExportRespondent } from './export-table'

const Q = {
  infoBasic1: 'q-info-b-1',
  infoBasic2: 'q-info-b-2',
  safetyAdvanced: 'q-safety-a-1',
  unshown: 'q-comm-i-1',
}

const person = (values: Partial<ExportRespondent> = {}): ExportRespondent => ({
  id: 'r-1',
  mode: 'online',
  fullName: 'Juan Dela Cruz',
  studentNumber: null,
  showIdentity: true,
  school: null,
  linkLabel: null,
  linkCode: null,
  course: null,
  yearLevel: null,
  sex: 'male',
  age: 19,
  devices: ['smartphone', 'laptop'],
  internetAccess: ['mobile_data'],
  consentVersion: '1',
  consentedAt: new Date('2026-11-10T02:00:00Z'),
  status: 'not_started',
  attemptId: null,
  attemptStatus: null,
  startedAt: null,
  submittedAt: null,
  voidReason: null,
  voidedAt: null,
  totalPoints: null,
  overallPct: null,
  overallLevel: null,
  questionOrder: null,
  ...values,
})

const finished = (values: Partial<ExportRespondent> = {}) =>
  person({
    status: 'finished',
    attemptId: 'a-1',
    attemptStatus: 'submitted',
    startedAt: new Date('2026-11-10T02:00:00Z'),
    submittedAt: new Date('2026-11-10T02:12:30Z'),
    totalPoints: 40,
    overallPct: 74.07,
    overallLevel: 'intermediate',
    questionOrder: [Q.infoBasic2, Q.infoBasic1, Q.safetyAdvanced],
    ...values,
  })

const data = (values: Partial<ExportData> = {}): ExportData => ({
  respondents: [],
  areas: [],
  sus: [],
  marks: [],
  questions: [
    // Item numbers run across the bank, with a gap where a question was deleted.
    {
      id: Q.infoBasic1,
      area: 'info_literacy',
      difficulty: 'basic',
      itemNumber: 1,
      stem: 'One',
      isActive: true,
    },
    {
      id: Q.infoBasic2,
      area: 'info_literacy',
      difficulty: 'basic',
      itemNumber: 4,
      stem: 'Two',
      isActive: false,
    },
    {
      id: Q.unshown,
      area: 'communication',
      difficulty: 'intermediate',
      itemNumber: 2,
      stem: 'Three',
      isActive: true,
    },
    {
      id: Q.safetyAdvanced,
      area: 'safety',
      difficulty: 'advanced',
      itemNumber: 7,
      stem: 'Four',
      isActive: true,
    },
  ],
  query: { sort: 'newest' },
  linkLabel: null,
  exportedAt: new Date('2026-11-16T06:00:00Z'),
  ...values,
})

/** The respondents sheet's rows as objects keyed by header. */
function table(input: ExportData) {
  const [sheet] = buildExport(input)
  const headers = sheet!.columns.map((column) => column.header)
  return {
    headers,
    rows: sheet!.rows.map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i]]))),
  }
}

describe('buildExport', () => {
  it('fills an online respondent’s profile, with empty school cells and a 0/1 per pick', () => {
    const { rows } = table(data({ respondents: [person()] }))
    expect(rows[0]).toMatchObject({
      'Respondent ID': 'r-1',
      Mode: 'Online',
      Name: 'Juan Dela Cruz',
      'Student number': null,
      'Identity shown': 'Yes',
      School: null,
      'School link': null,
      Course: null,
      'Year level': null,
      Sex: 'Male',
      Age: 19,
      'Age group': '18 to 20',
      'Device: Smartphone': 1,
      'Device: Laptop': 1,
      'Device: Tablet': 0,
      'Internet: Mobile data': 1,
      'Internet: Wi-Fi at home': 0,
      Status: 'Not started',
      'Overall %': null,
      'SUS score': null,
    })
  })

  it('shows Hidden for a hidden name and student number, and leaves no trace of them', () => {
    const hidden = person({
      mode: 'school',
      fullName: 'Maria Santos',
      studentNumber: 'C23-01-0001-MAN121',
      showIdentity: false,
      course: 'BSIT',
      yearLevel: 2,
      school: 'ACLC Mandaue',
      linkLabel: 'BSIT 2A',
      linkCode: 'ABCDEFGHJK',
    })
    const sheets = buildExport(data({ respondents: [hidden] }))
    const { rows } = table(data({ respondents: [hidden] }))
    expect(rows[0]).toMatchObject({
      Name: HIDDEN_IDENTITY,
      'Student number': HIDDEN_IDENTITY,
      'Identity shown': 'No',
      School: 'ACLC Mandaue',
      'School link': 'BSIT 2A',
      'Link code': 'ABCDEFGHJK',
      Course: 'BSIT',
      'Year level': 2,
    })
    expect(JSON.stringify(sheets)).not.toContain('Maria')
    expect(JSON.stringify(sheets)).not.toContain('C23-01-0001')
  })

  it('fills scores, SUS and a column per question shown for a finished attempt', () => {
    const { headers, rows } = table(
      data({
        respondents: [finished()],
        areas: [
          {
            attemptId: 'a-1',
            area: 'info_literacy',
            points: 12,
            pct: 66.67,
            level: 'intermediate',
          },
        ],
        sus: [{ attemptId: 'a-1', score: 75, answers: [4, 2, 4, 1, 5, 2, 3, 3, 4, 2] }],
        // Q.infoBasic2 was left blank.
        marks: [
          { attemptId: 'a-1', questionId: Q.infoBasic1, correct: true },
          { attemptId: 'a-1', questionId: Q.safetyAdvanced, correct: false },
        ],
      }),
    )
    // Named by each question's stored item number; unshown questions get no column.
    expect(headers.slice(-3)).toEqual(['INF-B01', 'INF-B04', 'SAF-A07'])
    expect(rows[0]).toMatchObject({
      Status: 'Finished',
      'Closed by timer': 'No',
      'Time taken (seconds)': 750,
      'Overall points': 40,
      'Overall %': 74.07,
      'Overall level': 'Intermediate',
      [`${AREA_LABELS.info_literacy} points`]: 12,
      [`${AREA_LABELS.info_literacy} %`]: 66.67,
      [`${AREA_LABELS.info_literacy} level`]: 'Intermediate',
      [`${AREA_LABELS.safety} points`]: null,
      'SUS score': 75,
      'SUS 1': 4,
      'SUS 10': 2,
      'INF-B01': 1,
      'INF-B04': 0,
      'SAF-A07': 0,
    })
  })

  it('leaves a question empty for a respondent whose assessment didn’t show it', () => {
    const { rows } = table(
      data({
        respondents: [
          finished(),
          finished({ id: 'r-2', attemptId: 'a-2', questionOrder: [Q.infoBasic1] }),
        ],
        marks: [{ attemptId: 'a-2', questionId: Q.infoBasic1, correct: true }],
      }),
    )
    expect(rows[1]).toMatchObject({ 'INF-B01': 1, 'INF-B04': null, 'SAF-A07': null })
  })

  it('keeps scores, SUS and questions out for a voided attempt, with its reason', () => {
    const voided = finished({
      status: 'voided',
      attemptStatus: 'voided',
      voidReason: 'duplicate',
      voidedAt: new Date('2026-11-11T02:00:00Z'),
      // finishedScore leaves these null in the query; set here to show the builder does too.
      totalPoints: 40,
    })
    const { headers, rows } = table(
      data({
        respondents: [voided],
        sus: [{ attemptId: 'a-1', score: 75, answers: [4, 2, 4, 1, 5, 2, 3, 3, 4, 2] }],
      }),
    )
    expect(rows[0]).toMatchObject({
      Status: 'Voided',
      'Void reason': 'Took it more than once',
      'Submitted at': null,
      'Overall points': null,
      'SUS score': null,
    })
    expect(headers).not.toContain('INF-B01')
  })

  it('lists the questions shown and explains every column and the filters in the codebook', () => {
    const [respondents, questions, codebook] = buildExport(
      data({
        respondents: [finished()],
        query: { sort: 'score_high', sex: 'female', status: 'finished', q: 'Cruz' },
      }),
    )
    expect(questions!.rows.map((row) => row[0])).toEqual(['INF-B01', 'INF-B04', 'SAF-A07'])
    expect(questions!.rows[1]).toEqual([
      'INF-B04',
      AREA_LABELS.info_literacy,
      'Basic',
      1,
      'No',
      Q.infoBasic2,
      'Two',
    ])

    const explained = new Map(codebook!.rows.map((row) => [row[0], row[1]]))
    for (const column of respondents!.columns.filter((c) => !/^[A-Z]{3}-/.test(c.header))) {
      expect(explained.get(column.header), column.header).toBeTruthy()
    }
    expect(explained.get('Filters')).toBe('Sex: Female; Status: Finished; Search: “Cruz”')
    expect(explained.get('Order')).toBe('Highest score')
    expect(explained.get('Respondents')).toBe(1)
  })
})
