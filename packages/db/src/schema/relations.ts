// Relations for Drizzle's query API (db.query.*.findMany({ with })). They add no SQL.
import { relations } from 'drizzle-orm'
import { answers, areaResults, attempts, susResponses } from './attempts'
import { choices, competencyAreas, lessons, questions } from './content'
import { kioskSessions, profiles, respondents } from './people'

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  respondent: one(respondents),
  kioskSessions: many(kioskSessions),
}))

export const respondentsRelations = relations(respondents, ({ one, many }) => ({
  profile: one(profiles, { fields: [respondents.profileId], references: [profiles.id] }),
  attempts: many(attempts),
}))

export const kioskSessionsRelations = relations(kioskSessions, ({ one, many }) => ({
  facilitator: one(profiles, { fields: [kioskSessions.facilitatorId], references: [profiles.id] }),
  attempts: many(attempts),
}))

export const competencyAreasRelations = relations(competencyAreas, ({ many }) => ({
  questions: many(questions),
  lessons: many(lessons),
  areaResults: many(areaResults),
}))

export const questionsRelations = relations(questions, ({ one, many }) => ({
  area: one(competencyAreas, { fields: [questions.areaId], references: [competencyAreas.id] }),
  choices: many(choices),
  answers: many(answers),
}))

export const choicesRelations = relations(choices, ({ one }) => ({
  question: one(questions, { fields: [choices.questionId], references: [questions.id] }),
}))

export const lessonsRelations = relations(lessons, ({ one }) => ({
  area: one(competencyAreas, { fields: [lessons.areaId], references: [competencyAreas.id] }),
}))

export const attemptsRelations = relations(attempts, ({ one, many }) => ({
  respondent: one(respondents, {
    fields: [attempts.respondentId],
    references: [respondents.id],
  }),
  kioskSession: one(kioskSessions, {
    fields: [attempts.kioskSessionId],
    references: [kioskSessions.id],
  }),
  answers: many(answers),
  areaResults: many(areaResults),
  sus: one(susResponses),
}))

export const answersRelations = relations(answers, ({ one }) => ({
  attempt: one(attempts, { fields: [answers.attemptId], references: [attempts.id] }),
  question: one(questions, { fields: [answers.questionId], references: [questions.id] }),
  choice: one(choices, { fields: [answers.choiceId], references: [choices.id] }),
}))

export const areaResultsRelations = relations(areaResults, ({ one }) => ({
  attempt: one(attempts, { fields: [areaResults.attemptId], references: [attempts.id] }),
  area: one(competencyAreas, { fields: [areaResults.areaId], references: [competencyAreas.id] }),
}))

export const susResponsesRelations = relations(susResponses, ({ one }) => ({
  attempt: one(attempts, { fields: [susResponses.attemptId], references: [attempts.id] }),
}))
