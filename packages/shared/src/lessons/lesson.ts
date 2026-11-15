import { z } from 'zod'
import { LESSON_TIERS_FOR_LEVEL } from '../assessment/scoring'
import { LEVELS, type LessonTier, type Level } from '../enums/values'

// Lessons (LES-01, LES-02): the slug in their link, their outside resources, and which levels
// each lesson tier is recommended for.

/** Lowercase words and digits joined by single dashes: `spot-scams-and-phishing`. */
export const LESSON_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const LESSON_SLUG_MAX = 80

export const lessonSlugSchema = z
  .string()
  .max(LESSON_SLUG_MAX)
  .regex(LESSON_SLUG_REGEX, { message: 'Use lowercase letters, numbers and single dashes.' })

export const LESSON_LINK_MAX = 2048
export const LESSON_RESOURCE_LABEL_MAX = 120

/**
 * An https link, as lessons hold them (picture, video, resources): the lesson page is https, so
 * an http picture would be mixed content the browser upgrades or blocks.
 */
export const httpsLinkSchema = (message: string) =>
  z
    .url({ protocol: /^https$/, message })
    .max(LESSON_LINK_MAX, { message: 'This link is too long.' })

/** An outside resource listed under a lesson: a name and an https link. */
export const lessonResourceSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, { message: 'Give the resource a name.' })
    .max(LESSON_RESOURCE_LABEL_MAX, {
      message: `Keep the name under ${LESSON_RESOURCE_LABEL_MAX} characters.`,
    }),
  url: httpsLinkSchema('Enter a link that starts with https://'),
})
export type LessonResource = z.infer<typeof lessonResourceSchema>

/** The levels a tier is recommended for, from LESSON_TIERS_FOR_LEVEL, in LEVELS order. */
export const levelsForLessonTier = (tier: LessonTier): Level[] =>
  LEVELS.filter((level) => (LESSON_TIERS_FOR_LEVEL[level] as readonly LessonTier[]).includes(tier))
