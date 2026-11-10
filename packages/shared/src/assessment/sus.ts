import { z } from 'zod'

// System Usability Scale survey (SUS-01, SUS-04).

/** 10 statements, each answered from 1 (Strongly disagree) to 5 (Strongly agree). */
export const SUS_STATEMENT_COUNT = 10
export const SUS_ANSWER_MIN = 1
export const SUS_ANSWER_MAX = 5

/** Pilot target from the PRD: 68 or higher is above average. */
export const SUS_TARGET_SCORE = 68

/**
 * The 10 statements in SUS order: odd ones (1, 3, ...) are positive, even ones negative, which
 * the scoring relies on. Brooke's wording in plain English, "the system" being DigiBridge.
 * Placeholder until the team's final wording.
 */
export const SUS_STATEMENTS = [
  'I would like to use DigiBridge often.',
  'I found DigiBridge more complicated than it needed to be.',
  'I thought DigiBridge was easy to use.',
  'I would need help from someone good with technology to use DigiBridge.',
  'I found that the parts of DigiBridge worked well together.',
  'I thought too many things in DigiBridge worked in different ways.',
  'I think most people would learn to use DigiBridge very quickly.',
  'I found DigiBridge very awkward to use.',
  'I felt very confident using DigiBridge.',
  'I needed to learn a lot of things before I could get going with DigiBridge.',
] as const satisfies readonly string[] & { length: typeof SUS_STATEMENT_COUNT }

/** The answers' meanings, from SUS_ANSWER_MIN to SUS_ANSWER_MAX. */
export const SUS_ANSWER_LABELS = [
  'Strongly disagree',
  'Disagree',
  'Neutral',
  'Agree',
  'Strongly agree',
] as const

const ANSWER_MESSAGE = 'Pick an answer from 1 to 5 for each statement.'
const ALL_MESSAGE = `Answer all ${SUS_STATEMENT_COUNT} statements.`

/** One answer: a whole number from 1 to 5. */
export const susAnswerSchema = z
  .int(ANSWER_MESSAGE)
  .min(SUS_ANSWER_MIN, ANSWER_MESSAGE)
  .max(SUS_ANSWER_MAX, ANSWER_MESSAGE)

/** The 10 answers, in statement order. */
export const susAnswersSchema = z
  .array(susAnswerSchema, ALL_MESSAGE)
  .length(SUS_STATEMENT_COUNT, ALL_MESSAGE)
  .meta({ id: 'SusAnswers' })
export type SusAnswers = z.infer<typeof susAnswersSchema>
