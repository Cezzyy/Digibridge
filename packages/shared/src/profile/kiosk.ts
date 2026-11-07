import type { z } from 'zod'
import {
  courseSchema,
  isYearLevelInCourse,
  yearLevelNotInCourseMessage,
  yearLevelSchema,
} from './course'
import { generalProfileSchema } from './general'
import { studentNumberSchema } from './student-number'

// The kiosk profile (KIO-03): the general profile plus ACLC's school details, all required.
// The school lists live in their own files, so another school's could be added later
// without touching the general profile.

export const schoolDetailsShape = {
  studentNumber: studentNumberSchema,
  course: courseSchema,
  yearLevel: yearLevelSchema,
}

/** Fields only the kiosk profile has. The general profile refuses them (PRO-06). */
export const SCHOOL_FIELDS = Object.keys(schoolDetailsShape) as (keyof typeof schoolDetailsShape)[]

/** Refined, so build on it with `.safeExtend()`, not `.extend()`. */
export const kioskProfileSchema = generalProfileSchema
  .extend(schoolDetailsShape)
  .superRefine((profile, ctx) => {
    if (!isYearLevelInCourse(profile.course, profile.yearLevel)) {
      ctx.addIssue({
        code: 'custom',
        path: ['yearLevel'],
        message: yearLevelNotInCourseMessage(profile.course),
      })
    }
  })
export type KioskProfile = z.infer<typeof kioskProfileSchema>
