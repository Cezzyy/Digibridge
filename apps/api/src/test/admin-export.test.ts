import { HIDDEN_IDENTITY, SUS_STATEMENT_COUNT } from '@digibridge/shared'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { app } from '../app'
import { env, signedIn } from './helpers'
import {
  addSchoolRespondent,
  attemptsOf,
  get,
  json,
  linkFor,
  respondent,
  rightChoice,
  save,
  start,
  submit,
  useQuestionBank,
  wrongChoice,
} from './fixtures'

useQuestionBank()

/** The CSV's rows as objects keyed by header. Test data has no commas, quotes or line breaks. */
async function csvRows(res: Response) {
  const bytes = new Uint8Array(await res.arrayBuffer())
  // The byte order mark; decoding drops it.
  expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  const [header, ...lines] = new TextDecoder().decode(bytes).trimEnd().split('\r\n')
  const headers = header!.split(',')
  return lines.map((line) => {
    const cells = line.split(',')
    return Object.fromEntries(headers.map((h, i) => [h, cells[i]]))
  })
}

/** An online respondent who answers the first two items (right, then wrong), submits and rates. */
async function finishedOnline() {
  const user = await respondent()
  await start(user.headers)
  const [attempt] = await attemptsOf(user.respondentId)
  const [first, second] = attempt!.questionOrder
  await save(attempt!.id, first!, await rightChoice(first!), user.headers)
  await save(attempt!.id, second!, await wrongChoice(second!), user.headers)
  await submit(attempt!.id, user.headers)
  await app.request(
    `/api/v1/attempts/${attempt!.id}/sus`,
    {
      method: 'POST',
      headers: { ...user.headers, ...json },
      body: JSON.stringify({ answers: Array(SUS_STATEMENT_COUNT).fill(3) }),
    },
    env,
  )
  return { ...user, attempt: attempt! }
}

describe('GET /api/v1/admin/export.csv', () => {
  it('is for admins only (DSH-06, DSH-07)', async () => {
    expect((await get('/api/v1/admin/export.csv')).status).toBe(401)
    const facilitator = await signedIn('facilitator')
    expect((await get('/api/v1/admin/export.csv', facilitator.headers)).status).toBe(403)
    const student = await signedIn('respondent')
    expect((await get('/api/v1/admin/export.xlsx', student.headers)).status).toBe(403)
  })

  it('downloads every respondent with scores, SUS and a column per item shown', async () => {
    const taker = await finishedOnline()
    const admin = await signedIn('admin')
    const res = await get('/api/v1/admin/export.csv', admin.headers)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    expect(res.headers.get('Content-Disposition')).toMatch(
      /^attachment; filename="digibridge-respondents-\d{4}-\d{2}-\d{2}\.csv"$/,
    )

    const [row] = await csvRows(res)
    expect(row).toMatchObject({
      'Respondent ID': taker.respondentId,
      Mode: 'Online',
      // `respondent()` leaves show_identity at its default, false.
      Name: HIDDEN_IDENTITY,
      'Student number': '',
      Status: 'Finished',
      'Closed by timer': 'No',
      'SUS score': '50',
      'SUS 1': '3',
    })
    expect(Number(row!['Overall points'])).toBeGreaterThan(0)
    // 30 item columns, from the bank's codes: the first answer right, the second wrong, the
    // rest blank and so 0.
    const items = Object.keys(row!).filter((key) => /^[A-Z]{3}-[BIA]\d{2}$/.test(key))
    expect(items).toHaveLength(30)
    expect(items.map((key) => row![key]).sort()).toEqual([...Array(29).fill('0'), '1'])
  })

  it('follows the filters, status, search and sort, and keeps hidden identities hidden', async () => {
    const link = await linkFor('BSIT 2A')
    const hidden = await addSchoolRespondent(
      { fullName: 'Maria Santos', consentedAt: new Date('2026-11-10T02:00:00Z') },
      { status: 'submitted', linkId: link.id, pct: 55.5 },
    )
    const shown = await addSchoolRespondent(
      {
        fullName: 'Pedro Reyes',
        showIdentity: true,
        sex: 'female',
        consentedAt: new Date('2026-11-11T02:00:00Z'),
      },
      { status: 'in_progress', linkId: link.id },
    )
    await respondent()
    const admin = await signedIn('admin')
    const download = async (query: string) =>
      csvRows(await get(`/api/v1/admin/export.csv${query}`, admin.headers))

    const school = await download(`?schoolLinkId=${link.id}&sort=oldest`)
    expect(school.map((row) => row['Respondent ID'])).toEqual([hidden.id, shown.id])
    expect(school[0]).toMatchObject({
      Name: HIDDEN_IDENTITY,
      'Student number': HIDDEN_IDENTITY,
      'Identity shown': 'No',
      'School link': 'BSIT 2A',
      Course: hidden.course,
      'Overall %': '55.5',
    })
    expect(school[1]).toMatchObject({
      Name: 'Pedro Reyes',
      'Student number': shown.studentNumber,
      Status: 'In progress',
      'Overall %': '',
    })

    expect((await download('?status=finished')).map((r) => r['Respondent ID'])).toEqual([hidden.id])
    expect((await download('?sex=female')).map((r) => r['Respondent ID'])).toEqual([shown.id])
    // A hidden name can't be found by searching it.
    expect(await download('?q=Maria')).toEqual([])
    expect((await download('?q=Pedro')).map((r) => r['Respondent ID'])).toEqual([shown.id])

    const all = await (await get('/api/v1/admin/export.csv', admin.headers)).text()
    expect(all).not.toContain('Maria')
    expect(all).not.toContain(hidden.studentNumber)
  })

  it('refuses a filter that isn’t valid', async () => {
    const admin = await signedIn('admin')
    expect((await get('/api/v1/admin/export.csv?status=done', admin.headers)).status).toBe(400)
  })
})

describe('GET /api/v1/admin/export.xlsx', () => {
  it('downloads a workbook with the respondents, the questions shown and a codebook', async () => {
    await finishedOnline()
    const link = await linkFor('BSIT 2A')
    const admin = await signedIn('admin')
    const res = await get(`/api/v1/admin/export.xlsx?schoolLinkId=${link.id}`, admin.headers)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    expect(res.headers.get('Content-Disposition')).toMatch(/\.xlsx"$/)

    const parts = unzipSync(new Uint8Array(await res.arrayBuffer()))
    const workbook = strFromU8(parts['xl/workbook.xml']!)
    expect(workbook).toContain('name="Respondents"')
    expect(workbook).toContain('name="Questions"')
    expect(workbook).toContain('name="Codebook"')
    // The link has no one yet: no respondents, no question columns, and the filter in words.
    expect(strFromU8(parts['xl/worksheets/sheet1.xml']!)).not.toContain('<row r="2">')
    expect(strFromU8(parts['xl/worksheets/sheet3.xml']!)).toContain('School link: BSIT 2A')

    const everyone = await get('/api/v1/admin/export.xlsx', admin.headers)
    const questions = strFromU8(
      unzipSync(new Uint8Array(await everyone.arrayBuffer()))['xl/worksheets/sheet2.xml']!,
    )
    expect(questions.match(/<row /g)).toHaveLength(31)
  })
})
