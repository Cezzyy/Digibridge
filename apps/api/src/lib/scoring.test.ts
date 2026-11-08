import {
  AREA_CODES,
  AREA_MAX_POINTS,
  DIFFICULTIES,
  ITEMS_PER_DIFFICULTY,
  OVERALL_MAX_POINTS,
  type AreaCode,
  type Difficulty,
} from '@digibridge/shared'
import { describe, expect, it } from 'vitest'
import { roundPct, scoreAttempt, type ScoredItem } from './scoring'

// A full attempt: 4 basic, 4 intermediate and 2 advanced items per area. Item IDs read like
// "safety-advanced-1", and each item's right choice is "<id>-right".
const items: ScoredItem[] = AREA_CODES.flatMap((area) =>
  DIFFICULTIES.flatMap((difficulty) =>
    Array.from({ length: ITEMS_PER_DIFFICULTY[difficulty] }, (_, n) => {
      const questionId = `${area}-${difficulty}-${n}`
      return { questionId, area, difficulty, correctChoiceId: `${questionId}-right` }
    }),
  ),
)

const right = (item: ScoredItem) => [item.questionId, `${item.questionId}-right`] as const
const wrong = (item: ScoredItem) => [item.questionId, `${item.questionId}-wrong`] as const
const itemsOf = (area: AreaCode, difficulty: Difficulty) =>
  items.filter((i) => i.area === area && i.difficulty === difficulty)

describe('scoreAttempt', () => {
  it('gives 100% and Advanced everywhere when every answer is right', () => {
    const score = scoreAttempt(items, new Map(items.map(right)))
    expect(score.overall).toEqual({
      points: OVERALL_MAX_POINTS,
      maxPoints: OVERALL_MAX_POINTS,
      pct: 100,
      level: 'advanced',
    })
    expect(score.areas.map((a) => a.area)).toEqual([...AREA_CODES])
    for (const area of score.areas) {
      expect(area).toMatchObject({ points: AREA_MAX_POINTS, maxPoints: AREA_MAX_POINTS })
      expect(area.level).toBe('advanced')
    }
  })

  it('gives 0% and Beginner when every answer is wrong, with 0 points per answer', () => {
    const score = scoreAttempt(items, new Map(items.map(wrong)))
    expect(score.overall).toMatchObject({ points: 0, pct: 0, level: 'beginner' })
    expect(score.answerPoints.size).toBe(items.length)
    expect([...score.answerPoints.values()].every((p) => p === 0)).toBe(true)
  })

  it('counts an unanswered item as 0 and leaves it out of the answer points', () => {
    const score = scoreAttempt(items, new Map())
    expect(score.overall).toMatchObject({ points: 0, maxPoints: OVERALL_MAX_POINTS })
    expect(score.answerPoints.size).toBe(0)
  })

  it('weighs basic 1, intermediate 2 and advanced 3', () => {
    const [basic, intermediate, advanced] = DIFFICULTIES.map((d) => itemsOf('safety', d)[0]!) as [
      ScoredItem,
      ScoredItem,
      ScoredItem,
    ]
    const score = scoreAttempt(items, new Map([right(basic), right(intermediate), right(advanced)]))
    expect(Object.fromEntries(score.answerPoints)).toEqual({
      [basic.questionId]: 1,
      [intermediate.questionId]: 2,
      [advanced.questionId]: 3,
    })
    expect(score.overall.points).toBe(6)
  })

  it('works out the PRD example: 4 basic, 2 intermediate and 1 advanced right is 61%, Intermediate', () => {
    const picked = [
      ...itemsOf('safety', 'basic'),
      ...itemsOf('safety', 'intermediate').slice(0, 2),
      ...itemsOf('safety', 'advanced').slice(0, 1),
    ]
    const safety = scoreAttempt(items, new Map(picked.map(right))).areas.find(
      (a) => a.area === 'safety',
    )
    expect(safety).toMatchObject({ points: 11, maxPoints: AREA_MAX_POINTS, level: 'intermediate' })
    expect(roundPct(safety!.pct)).toBe(61.11)
  })

  it('keeps 7 of 18 (38.9%) at Beginner, just under the Basic cut-off', () => {
    const seven = [
      ...itemsOf('communication', 'basic'),
      ...itemsOf('communication', 'advanced').slice(0, 1),
    ]
    const area = scoreAttempt(items, new Map(seven.map(right))).areas.find(
      (a) => a.area === 'communication',
    )
    expect(area).toMatchObject({ points: 7, level: 'beginner' })
  })

  it('never gives points for a question with no right choice', () => {
    const broken = [{ ...items[0]!, correctChoiceId: null }]
    const score = scoreAttempt(broken, new Map([[items[0]!.questionId, 'anything']]))
    expect(score.overall).toMatchObject({ points: 0, maxPoints: 1 })
  })

  it('ignores answers to questions outside the attempt', () => {
    const score = scoreAttempt(items, new Map([['not-in-attempt', 'x']]))
    expect(score.answerPoints.size).toBe(0)
    expect(score.overall.points).toBe(0)
  })
})
