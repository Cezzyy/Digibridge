import { z } from 'zod'
import { areaCodeSchema, CHOICES_PER_QUESTION } from '../assessment/rules'
import { difficultySchema } from '../enums/values'
import { httpsLinkSchema } from '../lessons/lesson'

// A question as an admin writes it in the questions editor (CMS-01, CMS-03): what the API checks
// on create and edit, and what the editor's form checks before it sends. The CSV import (CMS-06)
// can check its rows with it too.

/** Room for a short scenario (a message, a post) and the question under it. */
export const QUESTION_STEM_MAX = 1500
export const QUESTION_CHOICE_MAX = 300
export const QUESTION_EXPLANATION_MAX = 1000

/** One of a question's choices, in its position (A to D). */
export const choiceInputSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, { message: 'Write this choice.' })
    .max(QUESTION_CHOICE_MAX, {
      message: `Keep each choice under ${QUESTION_CHOICE_MAX} characters.`,
    }),
  isCorrect: z.boolean(),
})
export type ChoiceInput = z.infer<typeof choiceInputSchema>

/**
 * Exactly CHOICES_PER_QUESTION choices, exactly 1 of them correct, and no two the same (CMS-03).
 * The choices are shuffled for each student (ASM-02), so their order here is only the editor's.
 */
export const choicesInputSchema = z
  .array(choiceInputSchema)
  .length(CHOICES_PER_QUESTION, { message: `Write exactly ${CHOICES_PER_QUESTION} choices.` })
  .superRefine((choices, ctx) => {
    if (choices.filter((choice) => choice.isCorrect).length !== 1) {
      ctx.addIssue({ code: 'custom', message: 'Mark exactly one choice as the right answer.' })
    }
    const seen = new Set<string>()
    choices.forEach((choice, i) => {
      const key = choice.label.toLowerCase()
      if (key && seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: [i, 'label'],
          message: 'Two choices say the same thing.',
        })
      }
      seen.add(key)
    })
  })

export const questionInputSchema = z.object({
  area: areaCodeSchema,
  difficulty: difficultySchema,
  stem: z
    .string()
    .max(QUESTION_STEM_MAX, { message: `Keep the question under ${QUESTION_STEM_MAX} characters.` })
    .refine((stem) => stem.trim().length > 0, { message: 'Write the question.' })
    // Trimmed at the ends only: blank lines inside split the stem into paragraphs.
    .transform((stem) => stem.trim()),
  // Uploads (CMS-05) will put /api/v1/media/<key> links here; for now it's any https image.
  imageUrl: httpsLinkSchema('Enter an image link that starts with https://').nullable(),
  // A scenario item sets a situation (a message, a post) before asking (TRD "Assessment engine").
  isScenario: z.boolean(),
  // For the team only: students never see per-item marks (RES-05). Empty is saved as null.
  explanation: z
    .string()
    .trim()
    .max(QUESTION_EXPLANATION_MAX, {
      message: `Keep the explanation under ${QUESTION_EXPLANATION_MAX} characters.`,
    })
    .nullable()
    .transform((text) => text || null),
  choices: choicesInputSchema,
  // Only active questions go into new attempts. A question that has been shown can't be deleted,
  // only made inactive (CMS-02).
  isActive: z.boolean(),
})
export type QuestionInput = z.input<typeof questionInputSchema>

/** The index of a question's right choice, or -1 if it has none. */
export const correctChoiceIndex = (choices: readonly { isCorrect: boolean }[]) =>
  choices.findIndex((choice) => choice.isCorrect)
