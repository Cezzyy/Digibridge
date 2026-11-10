import { SUS_ANSWER_MAX, SUS_ANSWER_MIN, type SusAnswers } from '@digibridge/shared'

// System Usability Scale score (SUS-04, TRD "SUS scoring"). Pure, so the unit tests need no
// database.

/**
 * The SUS score, 0 to 100 in steps of 2.5, from the 10 answers in statement order. Odd-numbered
 * statements (positive) count the answer minus 1, even-numbered ones (negative) 5 minus the
 * answer, and the total of 0 to 40 is scaled by 2.5.
 */
export function susScore(answers: SusAnswers): number {
  const total = answers.reduce(
    (sum, answer, i) => sum + (i % 2 === 0 ? answer - SUS_ANSWER_MIN : SUS_ANSWER_MAX - answer),
    0,
  )
  return total * 2.5
}
