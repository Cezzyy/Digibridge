import {
  ageGroupSchema,
  areaCodeSchema,
  attemptStatusSchema,
  difficultySchema,
  levelSchema,
  modeSchema,
  respondentListQuerySchema,
  respondentStatusSchema,
  sexSchema,
  STAFF_ROLES,
  SUS_ANSWER_MAX,
  SUS_ANSWER_MIN,
  SUS_STATEMENT_COUNT,
  voidAttemptSchema,
  voidReasonSchema,
} from '@digibridge/shared'
import { createRoute, z } from '@hono/zod-openapi'
import { auth, requireRole } from '../middleware'
import { errorResponse } from '../openapi'
import { ADMIN_ERRORS, STAFF_ERRORS } from './admin'
import { AttemptParamsSchema } from './attempts'

// The respondents table and one respondent's details (DSH-05, DSH-07, PRO-05). Staff read them;
// only admins get the answer sheet. A respondent who chose not to show who they are has a null
// name and student number, and `identityHidden` set, everywhere.

/** A respondent as a row of the table. */
export const AdminRespondentSchema = z
  .object({
    id: z.uuid(),
    mode: modeSchema,
    // Null when the respondent chose not to show who they are (PRO-05).
    fullName: z.string().nullable(),
    // Null online, and when hidden.
    studentNumber: z.string().nullable(),
    identityHidden: z.boolean(),
    // Null online.
    course: z.string().nullable(),
    yearLevel: z.int().nullable(),
    sex: sexSchema,
    // On the day they consented, in the Philippines.
    age: z.int(),
    ageGroup: ageGroupSchema,
    devices: z.array(z.string()),
    internetAccess: z.array(z.string()),
    consentedAt: z.iso.datetime(),
    status: respondentStatusSchema,
    // The link their attempt came from; null online or before they start.
    schoolLink: z.object({ id: z.uuid(), label: z.string() }).nullable(),
    // Their attempt: the one that isn't voided, or else the latest voided one.
    attemptId: z.uuid().nullable(),
    overallPct: z.number().nullable(),
    overallLevel: levelSchema.nullable(),
    submittedAt: z.iso.datetime().nullable(),
  })
  .openapi('AdminRespondent')

export const listRespondentsRoute = createRoute({
  method: 'get',
  path: '/admin/respondents',
  tags: ['Admin'],
  summary: 'The respondents table',
  description:
    'Paged, filtered and sorted. Every dashboard filter, plus status, a search on shown names and student numbers, the sort and the page. Hidden names and student numbers are never sent, searched or sorted on (PRO-05). Staff (DSH-05, DSH-07).',
  middleware: [auth, requireRole(...STAFF_ROLES)] as const,
  security: [{ Bearer: [] }],
  request: { query: respondentListQuerySchema },
  responses: {
    200: {
      description: 'One page of respondents',
      content: {
        'application/json': {
          schema: z
            .object({
              respondents: z.array(AdminRespondentSchema),
              // Respondents matching the filters, across every page.
              total: z.int(),
              page: z.int(),
              pageSize: z.int(),
            })
            .openapi('AdminRespondentPage'),
        },
      },
    },
    400: errorResponse('A filter, the sort or the page is not valid'),
    ...STAFF_ERRORS,
  },
})

/** One item of the answer sheet, in the order the respondent saw it. */
const AnsweredItemSchema = z
  .object({
    questionId: z.uuid(),
    area: areaCodeSchema,
    difficulty: difficultySchema,
    stem: z.string(),
    // In the order the respondent saw them.
    choices: z.array(z.object({ id: z.uuid(), label: z.string(), isCorrect: z.boolean() })),
    // Null when left unanswered.
    pickedChoiceId: z.uuid().nullable(),
    correct: z.boolean(),
    // Set once the attempt is scored.
    points: z.int().nullable(),
  })
  .openapi('AnsweredItem')

const AdminAttemptSchema = z
  .object({
    id: z.uuid(),
    status: attemptStatusSchema,
    startedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    // When it was submitted, or `expires_at` when the timer closed it.
    submittedAt: z.iso.datetime().nullable(),
    timeTakenSeconds: z.int().nullable(),
    totalPoints: z.int().nullable(),
    overallPct: z.number().nullable(),
    overallLevel: levelSchema.nullable(),
    // Set once voided (USR-03): the reason, the admin's note (required with `other`) and when.
    voidReason: voidReasonSchema.nullable(),
    voidNote: z.string().nullable(),
    voidedAt: z.iso.datetime().nullable(),
    // Empty until scored.
    areas: z.array(
      z.object({
        area: areaCodeSchema,
        points: z.int(),
        maxPoints: z.int(),
        pct: z.number(),
        level: levelSchema,
      }),
    ),
    // Null until they answer the survey.
    sus: z
      .object({
        score: z.number(),
        answers: z
          .array(z.int().min(SUS_ANSWER_MIN).max(SUS_ANSWER_MAX))
          .length(SUS_STATEMENT_COUNT),
      })
      .nullable(),
    // Admins only; null for facilitators.
    answers: z.array(AnsweredItemSchema).nullable(),
  })
  .openapi('AdminAttempt')

const RespondentParamsSchema = z.object({
  id: z.uuid().openapi({ param: { name: 'id', in: 'path' }, description: 'The respondent' }),
})

export const getRespondentRoute = createRoute({
  method: 'get',
  path: '/admin/respondents/{id}',
  tags: ['Admin'],
  summary: 'One respondent’s profile and results',
  description:
    'The profile, area scores and SUS answers of their attempt (the one that isn’t voided, or else the latest voided one). Admins also get the answer sheet: each item with the choice picked and the right one. Staff (DSH-05, DSH-07).',
  middleware: [auth, requireRole(...STAFF_ROLES)] as const,
  security: [{ Bearer: [] }],
  request: { params: RespondentParamsSchema },
  responses: {
    200: {
      description: 'The respondent',
      content: {
        'application/json': {
          schema: z
            .object({
              respondent: AdminRespondentSchema,
              // Null before they start.
              attempt: AdminAttemptSchema.nullable(),
            })
            .openapi('AdminRespondentDetail'),
        },
      },
    },
    ...STAFF_ERRORS,
    404: errorResponse('No respondent with this id'),
  },
})

export const deleteRespondentRoute = createRoute({
  method: 'delete',
  path: '/admin/respondents/{id}',
  tags: ['Admin'],
  summary: 'Delete a respondent’s data',
  description:
    'On the respondent’s request (USR-03): their profile and consent, their attempts with every answer, area result and SUS response. It can’t be undone. An online respondent’s Google account stays, so signing in again starts over from the notice; a school-link student frees their place on the link and their student number. Admin only.',
  middleware: [auth, requireRole('admin')] as const,
  security: [{ Bearer: [] }],
  request: { params: RespondentParamsSchema },
  responses: {
    204: { description: 'Deleted' },
    400: errorResponse('The ID is not valid'),
    ...ADMIN_ERRORS,
    404: errorResponse('No respondent with this ID'),
  },
})

const VoidedAttemptSchema = z
  .object({
    id: z.uuid(),
    status: z.literal('voided'),
    voidReason: voidReasonSchema,
    voidNote: z.string().nullable(),
    voidedAt: z.iso.datetime(),
  })
  .openapi('VoidedAttempt')

export const voidAttemptRoute = createRoute({
  method: 'post',
  path: '/admin/attempts/{id}/void',
  tags: ['Admin'],
  summary: 'Void an attempt',
  description:
    'For an attempt that went wrong (USR-03), in progress or finished: a reason and a note (required with `other`). A voided attempt is left out of every result and stat, its answers and scores stay for the record, and the respondent can start again. One in progress stops taking answers at once. A school-link student whose browser no longer holds their place can join the link again with the same student number. Admin only.',
  middleware: [auth, requireRole('admin')] as const,
  security: [{ Bearer: [] }],
  request: {
    params: AttemptParamsSchema,
    body: {
      content: { 'application/json': { schema: voidAttemptSchema.meta({ id: 'VoidAttempt' }) } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Voided',
      content: { 'application/json': { schema: z.object({ attempt: VoidedAttemptSchema }) } },
    },
    400: errorResponse('The ID, the reason or the note is not valid'),
    ...ADMIN_ERRORS,
    404: errorResponse('No attempt with this ID'),
    409: errorResponse('Already voided'),
  },
})
