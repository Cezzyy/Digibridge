import { z } from 'zod'
import { areaCodeSchema } from '../assessment/rules'
import { lessonTierSchema } from '../enums/values'
import { LESSON_SLUG_MAX, lessonResourceSchema, lessonSlugSchema } from './lesson'

// A lesson as an admin writes it in the lessons editor (CMS-04): what the API checks on create
// and edit, and what the editor's form checks before it sends.

export const LESSON_TITLE_MAX = 120
export const LESSON_SUMMARY_MAX = 300
/** About 8,000 words, well past the longest starter lesson. */
export const LESSON_BODY_MAX = 50_000
export const LESSON_RESOURCES_MAX = 10

const HTTP_LINK = /^https?$/

/** An optional http(s) link: null when the admin leaves it empty. */
const optionalLink = (message: string) => z.url({ protocol: HTTP_LINK, message }).nullable()

export const lessonInputSchema = z.object({
  area: areaCodeSchema,
  tier: lessonTierSchema,
  slug: lessonSlugSchema,
  title: z
    .string()
    .trim()
    .min(1, { message: 'Give the lesson a title.' })
    .max(LESSON_TITLE_MAX, { message: `Keep the title under ${LESSON_TITLE_MAX} characters.` }),
  summary: z
    .string()
    .trim()
    .min(1, { message: 'Write a one-line summary for the lesson’s card.' })
    .max(LESSON_SUMMARY_MAX, {
      message: `Keep the summary under ${LESSON_SUMMARY_MAX} characters.`,
    }),
  bodyMd: z
    .string()
    .max(LESSON_BODY_MAX, { message: 'This lesson is too long. Split it into two.' })
    .refine((body) => body.trim().length > 0, { message: 'Write the lesson’s text.' }),
  // Uploads (CMS-05) will put /api/v1/media/<key> links here; for now it's any https image.
  imageUrl: optionalLink('Enter an image link that starts with https://'),
  videoUrl: optionalLink('Enter a video link that starts with https://'),
  resources: z
    .array(lessonResourceSchema)
    .max(LESSON_RESOURCES_MAX, { message: `List at most ${LESSON_RESOURCES_MAX} resources.` }),
  // Only one lesson per area and tier is published at a time (LES-01): publishing this one
  // takes the place of the one before.
  isPublished: z.boolean(),
})
export type LessonInput = z.infer<typeof lessonInputSchema>

/**
 * A slug made from a title, for the editor to suggest: "Spot scams & phishing!" becomes
 * `spot-scams-phishing`. Accents are dropped, and it's cut at a dash to fit LESSON_SLUG_MAX.
 */
export function slugFromTitle(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Apostrophes join their word: "you’ll" becomes "youll", not "you-ll".
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (slug.length <= LESSON_SLUG_MAX) return slug
  const cut = slug.slice(0, LESSON_SLUG_MAX + 1)
  const lastDash = cut.lastIndexOf('-')
  return (lastDash > 0 ? cut.slice(0, lastDash) : cut.slice(0, LESSON_SLUG_MAX)).replace(/-+$/, '')
}
