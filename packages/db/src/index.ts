// Package entry: the Drizzle schema and the row types the API uses.
import * as schema from './schema'

export * from './schema'
export { schema }

export type Profile = typeof schema.profiles.$inferSelect
export type Respondent = typeof schema.respondents.$inferSelect
export type NewRespondent = typeof schema.respondents.$inferInsert
export type KioskSession = typeof schema.kioskSessions.$inferSelect
export type CompetencyArea = typeof schema.competencyAreas.$inferSelect
export type Question = typeof schema.questions.$inferSelect
export type Choice = typeof schema.choices.$inferSelect
export type Lesson = typeof schema.lessons.$inferSelect
export type Attempt = typeof schema.attempts.$inferSelect
export type Answer = typeof schema.answers.$inferSelect
export type AreaResult = typeof schema.areaResults.$inferSelect
export type SusResponse = typeof schema.susResponses.$inferSelect
