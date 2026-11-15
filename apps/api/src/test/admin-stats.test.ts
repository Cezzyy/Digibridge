import { areaResults, competencyAreas, susResponses } from '@digibridge/db'
import { AREA_CODES } from '@digibridge/shared'
import { describe, expect, it } from 'vitest'
import { signedIn, testDb } from './helpers'
import { get, useQuestionBank, respondent, linkFor, addSchoolRespondent } from './fixtures'

useQuestionBank()

describe('GET /api/v1/admin/stats', () => {
  type Stats = {
    respondents: number
    finished: number
    completionRate: number | null
    averageOverallPct: number | null
    medianTimeSeconds: number | null
    overallLevels: Record<string, number>
    areas: { area: string; averagePct: number | null; levels: Record<string, number> }[]
    sus: { responses: number; mean: number | null; statementMeans: (number | null)[] }
    comparison: { groupBy: string; groups: { key: string; label: string; finished: number }[] }
  }
  const stats = async (query: string, headers: Record<string, string>) => {
    const res = await get(`/api/v1/admin/stats${query}`, headers)
    return { status: res.status, body: (await res.json()) as Stats }
  }

  /** Area results at `pct` in every area, for an attempt. */
  const addAreaResults = async (attemptId: string, pct: number) => {
    const areas = await testDb.select().from(competencyAreas)
    await testDb.insert(areaResults).values(
      areas.map((area) => ({
        attemptId,
        areaId: area.id,
        points: 9,
        maxPoints: 18,
        pct,
        level: 'basic' as const,
      })),
    )
  }

  it('sums up finished attempts only, with SUS and a comparison (DSH-01 to DSH-04, SUS-05)', async () => {
    const link = await linkFor('BSIT 2A')
    const done = await addSchoolRespondent({}, { status: 'submitted', linkId: link.id, pct: 50 })
    await addAreaResults(done.attemptId!, 50)
    await testDb.insert(susResponses).values({
      attemptId: done.attemptId!,
      ...{ q1: 5, q2: 1, q3: 5, q4: 1, q5: 5, q6: 1, q7: 5, q8: 1, q9: 5, q10: 1 },
      score: 100,
    })
    await addSchoolRespondent({}, { status: 'in_progress', linkId: link.id })
    await addSchoolRespondent({}, { status: 'voided', linkId: link.id })
    await respondent()

    const staff = await signedIn('facilitator')
    const { status, body } = await stats('', staff.headers)
    expect(status).toBe(200)
    expect(body).toMatchObject({
      respondents: 4,
      finished: 1,
      completionRate: 25,
      averageOverallPct: 50,
      medianTimeSeconds: expect.any(Number),
      overallLevels: { beginner: 0, basic: 1, intermediate: 0, advanced: 0 },
      sus: { responses: 1, mean: 100 },
      comparison: {
        groupBy: 'mode',
        groups: [{ key: 'school', label: 'School link', finished: 1 }],
      },
    })
    expect(body.areas.map((area) => area.area)).toEqual(AREA_CODES)
    expect(body.areas[0]).toMatchObject({ averagePct: 50, levels: { basic: 1 } })
    expect(body.sus.statementMeans).toEqual([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])
  })

  it('follows the filters and groups by school link', async () => {
    const a = await linkFor('BSIT 2A')
    const b = await linkFor('BSCS 1A')
    await addSchoolRespondent({}, { status: 'submitted', linkId: a.id, pct: 80 })
    await addSchoolRespondent({ course: 'BSCS' }, { status: 'expired', linkId: b.id, pct: 20 })
    await respondent()
    const admin = await signedIn('admin')

    const byLink = await stats('?groupBy=school_link', admin.headers)
    expect(byLink.body.comparison.groups.map((g) => g.label)).toEqual(['BSCS 1A', 'BSIT 2A'])

    const bscs = await stats('?course=BSCS', admin.headers)
    expect(bscs.body).toMatchObject({ respondents: 1, finished: 1, averageOverallPct: 20 })
    const online = await stats('?mode=online', admin.headers)
    expect(online.body).toMatchObject({ respondents: 1, finished: 0, averageOverallPct: null })
  })

  it('refuses respondents and an unknown grouping', async () => {
    const user = await signedIn()
    expect((await stats('', user.headers)).status).toBe(403)
    const admin = await signedIn('admin')
    expect((await stats('?groupBy=name', admin.headers)).status).toBe(400)
  })
})
