import {
  AGE_GROUP_LABELS,
  AGE_GROUPS,
  ageGroupFor,
  AREA_CODES,
  COURSES,
  DEVICE_LABELS,
  DEVICES,
  INTERNET_ACCESS,
  INTERNET_ACCESS_LABELS,
  LEVELS,
  MODE_LABELS,
  MODES,
  SEX_LABELS,
  SEXES,
  SUS_BIN_WIDTH,
  SUS_STATEMENT_COUNT,
  YEAR_LEVEL_LABELS,
  YEAR_LEVELS,
  type AreaCode,
  type Level,
  type Mode,
  type Sex,
  type StatsGroup,
  type YearLevel,
} from '@digibridge/shared'
import { roundPct } from './scoring'

// The analysis page's numbers (DSH-01 to DSH-04, SUS-05), worked out from the rows the stats
// handler reads. Pure, so it's tested on its own. Percentages are rounded to 2 decimals.

/** A finished attempt and the profile of the respondent who took it. */
export type FinishedRow = {
  attemptId: string
  mode: Mode
  sex: Sex
  age: number
  devices: string[]
  internetAccess: string[]
  course: string | null
  yearLevel: number | null
  linkId: string | null
  linkLabel: string | null
  overallPct: number
  overallLevel: Level
  timeTakenSeconds: number
}

export type AreaRow = { attemptId: string; area: AreaCode; pct: number; level: Level }

export type SusRow = { score: number; answers: number[] }

export type StatsInput = {
  /** Respondents who match the filters, finished or not. */
  respondents: number
  finished: FinishedRow[]
  areas: AreaRow[]
  sus: SusRow[]
}

const mean = (values: number[]) =>
  values.length === 0 ? null : roundPct(values.reduce((sum, v) => sum + v, 0) / values.length)

export function median(values: number[]) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

const levelCounts = (levels: Level[]) =>
  Object.fromEntries(
    LEVELS.map((level) => [level, levels.filter((l) => l === level).length]),
  ) as Record<Level, number>

/** Each statement's average answer, and how many scores fall in each SUS_BIN_WIDTH-wide bin. */
export function summarizeSus(rows: SusRow[]) {
  const bins = Array.from({ length: 100 / SUS_BIN_WIDTH }, (_, i) => ({
    from: i * SUS_BIN_WIDTH,
    to: (i + 1) * SUS_BIN_WIDTH,
    count: 0,
  }))
  for (const { score } of rows) {
    const bin = bins[Math.min(Math.floor(score / SUS_BIN_WIDTH), bins.length - 1)]
    if (bin) bin.count++
  }
  return {
    responses: rows.length,
    mean: mean(rows.map((row) => row.score)),
    bins,
    statementMeans: Array.from({ length: SUS_STATEMENT_COUNT }, (_, i) =>
      mean(rows.flatMap((row) => (row.answers[i] === undefined ? [] : [row.answers[i]]))),
    ),
  }
}

type Group = { key: string; label: string }

/** The groups a respondent falls in for a grouping, in the order the chart lists them. */
const KNOWN_ORDER: Record<Exclude<StatsGroup, 'school_link'>, readonly (string | number)[]> = {
  mode: MODES,
  sex: SEXES,
  age_group: AGE_GROUPS,
  device: DEVICES,
  internet_access: INTERNET_ACCESS,
  course: COURSES,
  year_level: YEAR_LEVELS,
}

function groupsOf(row: FinishedRow, groupBy: StatsGroup): Group[] {
  switch (groupBy) {
    case 'mode':
      return [{ key: row.mode, label: MODE_LABELS[row.mode] }]
    case 'sex':
      return [{ key: row.sex, label: SEX_LABELS[row.sex] }]
    case 'age_group': {
      const group = ageGroupFor(row.age)
      return [{ key: group, label: AGE_GROUP_LABELS[group] }]
    }
    case 'device':
      return row.devices.map((d) => ({
        key: d,
        label: DEVICE_LABELS[d as keyof typeof DEVICE_LABELS] ?? d,
      }))
    case 'internet_access':
      return row.internetAccess.map((a) => ({
        key: a,
        label: INTERNET_ACCESS_LABELS[a as keyof typeof INTERNET_ACCESS_LABELS] ?? a,
      }))
    case 'course':
      return row.course ? [{ key: row.course, label: row.course }] : []
    case 'year_level':
      return row.yearLevel
        ? [{ key: String(row.yearLevel), label: YEAR_LEVEL_LABELS[row.yearLevel as YearLevel] }]
        : []
    case 'school_link':
      return row.linkId ? [{ key: row.linkId, label: row.linkLabel ?? row.linkId }] : []
  }
}

/** The average overall and per-area scores of each group that has finished respondents. */
export function compare(
  finished: FinishedRow[],
  areasByAttempt: Map<string, AreaRow[]>,
  groupBy: StatsGroup,
) {
  const groups = new Map<string, Group & { rows: FinishedRow[] }>()
  for (const row of finished) {
    for (const group of groupsOf(row, groupBy)) {
      const entry = groups.get(group.key) ?? { ...group, rows: [] }
      entry.rows.push(row)
      groups.set(group.key, entry)
    }
  }
  const order = groupBy === 'school_link' ? null : KNOWN_ORDER[groupBy].map(String)
  const sorted = [...groups.values()].sort((a, b) =>
    order ? order.indexOf(a.key) - order.indexOf(b.key) : a.label.localeCompare(b.label),
  )
  return sorted.map(({ key, label, rows }) => ({
    key,
    label,
    finished: rows.length,
    averageOverallPct: mean(rows.map((row) => row.overallPct)),
    areas: AREA_CODES.map((area) => ({
      area,
      averagePct: mean(
        rows.flatMap((row) =>
          (areasByAttempt.get(row.attemptId) ?? [])
            .filter((r) => r.area === area)
            .map((r) => r.pct),
        ),
      ),
    })),
  }))
}

export function buildStats(input: StatsInput, groupBy: StatsGroup) {
  const { finished, areas } = input
  const areasByAttempt = new Map<string, AreaRow[]>()
  for (const row of areas) {
    areasByAttempt.set(row.attemptId, [...(areasByAttempt.get(row.attemptId) ?? []), row])
  }
  return {
    respondents: input.respondents,
    finished: finished.length,
    completionRate:
      input.respondents === 0 ? null : roundPct((finished.length / input.respondents) * 100),
    averageOverallPct: mean(finished.map((row) => row.overallPct)),
    medianTimeSeconds: median(finished.map((row) => row.timeTakenSeconds)),
    overallLevels: levelCounts(finished.map((row) => row.overallLevel)),
    areas: AREA_CODES.map((area) => {
      const inArea = areas.filter((row) => row.area === area)
      return {
        area,
        averagePct: mean(inArea.map((row) => row.pct)),
        levels: levelCounts(inArea.map((row) => row.level)),
      }
    }),
    sus: summarizeSus(input.sus),
    comparison: { groupBy, groups: compare(finished, areasByAttempt, groupBy) },
  }
}
