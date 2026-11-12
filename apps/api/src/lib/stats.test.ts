import { describe, expect, it } from 'vitest'
import { buildStats, median, summarizeSus, type AreaRow, type FinishedRow } from './stats'

const row = (overrides: Partial<FinishedRow> = {}): FinishedRow => ({
  attemptId: crypto.randomUUID(),
  mode: 'online',
  sex: 'female',
  age: 19,
  devices: ['smartphone'],
  internetAccess: ['mobile_data'],
  course: null,
  yearLevel: null,
  linkId: null,
  linkLabel: null,
  overallPct: 50,
  overallLevel: 'basic',
  timeTakenSeconds: 600,
  ...overrides,
})

const areasFor = (attemptId: string, pct: number): AreaRow[] =>
  (['info_literacy', 'communication', 'safety'] as const).map((area) => ({
    attemptId,
    area,
    pct,
    level: pct >= 60 ? 'intermediate' : 'basic',
  }))

describe('median', () => {
  it('takes the middle value, or the mean of the two middle ones', () => {
    expect(median([])).toBeNull()
    expect(median([300, 100, 200])).toBe(200)
    expect(median([100, 400, 200, 300])).toBe(250)
  })
})

describe('summarizeSus', () => {
  it('averages the scores and each statement, and bins the scores by 10', () => {
    const sus = summarizeSus([
      { score: 100, answers: [5, 1, 5, 1, 5, 1, 5, 1, 5, 1] },
      { score: 50, answers: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3] },
      { score: 47.5, answers: [3, 3, 3, 3, 3, 3, 3, 3, 3, 4] },
    ])
    expect(sus.responses).toBe(3)
    expect(sus.mean).toBe(65.83)
    expect(sus.statementMeans[0]).toBe(3.67)
    expect(sus.statementMeans[9]).toBe(2.67)
    expect(sus.bins).toHaveLength(10)
    // 47.5 goes in 40 to 50, 50 in 50 to 60, and 100 in the last bin.
    expect(sus.bins.map((bin) => bin.count)).toEqual([0, 0, 0, 0, 1, 1, 0, 0, 0, 1])
  })

  it('has no means without responses', () => {
    const sus = summarizeSus([])
    expect(sus).toMatchObject({ responses: 0, mean: null })
    expect(sus.statementMeans.every((m) => m === null)).toBe(true)
  })
})

describe('buildStats', () => {
  it('counts completion, averages and levels', () => {
    const a = row({ overallPct: 40, overallLevel: 'basic', timeTakenSeconds: 900 })
    const b = row({ overallPct: 80, overallLevel: 'advanced', timeTakenSeconds: 1200 })
    const stats = buildStats(
      {
        respondents: 4,
        finished: [a, b],
        areas: [...areasFor(a.attemptId, 40), ...areasFor(b.attemptId, 70)],
        sus: [],
      },
      'mode',
    )
    expect(stats).toMatchObject({
      respondents: 4,
      finished: 2,
      completionRate: 50,
      averageOverallPct: 60,
      medianTimeSeconds: 1050,
      overallLevels: { beginner: 0, basic: 1, intermediate: 0, advanced: 1 },
    })
    expect(stats.areas[0]).toEqual({
      area: 'info_literacy',
      averagePct: 55,
      levels: { beginner: 0, basic: 1, intermediate: 1, advanced: 0 },
    })
  })

  it('has no rates or averages for nobody', () => {
    const stats = buildStats({ respondents: 0, finished: [], areas: [], sus: [] }, 'sex')
    expect(stats).toMatchObject({
      completionRate: null,
      averageOverallPct: null,
      medianTimeSeconds: null,
      comparison: { groupBy: 'sex', groups: [] },
    })
  })

  it('groups in the option order, and counts a multi-pick respondent in each group', () => {
    const both = row({ devices: ['smartphone', 'laptop'], overallPct: 60 })
    const phone = row({ devices: ['smartphone'], overallPct: 30 })
    const { comparison } = buildStats(
      { respondents: 2, finished: [phone, both], areas: areasFor(both.attemptId, 60), sus: [] },
      'device',
    )
    expect(comparison.groups.map((g) => [g.key, g.label, g.finished, g.averageOverallPct])).toEqual(
      [
        ['smartphone', 'Smartphone', 2, 45],
        ['laptop', 'Laptop', 1, 60],
      ],
    )
    expect(comparison.groups[1]?.areas[0]).toEqual({ area: 'info_literacy', averagePct: 60 })
  })

  it('leaves online respondents out of school-only groupings, and names links by label', () => {
    const online = row()
    const school = row({
      mode: 'school',
      course: 'BSIT',
      yearLevel: 2,
      linkId: 'l1',
      linkLabel: 'BSIT 2A',
    })
    const input = { respondents: 2, finished: [online, school], areas: [], sus: [] }
    expect(buildStats(input, 'course').comparison.groups.map((g) => g.key)).toEqual(['BSIT'])
    expect(buildStats(input, 'year_level').comparison.groups[0]).toMatchObject({
      key: '2',
      label: '2nd year',
    })
    expect(buildStats(input, 'school_link').comparison.groups[0]).toMatchObject({
      key: 'l1',
      label: 'BSIT 2A',
    })
    expect(buildStats(input, 'age_group').comparison.groups[0]).toMatchObject({
      key: '18_20',
      finished: 2,
    })
  })
})
