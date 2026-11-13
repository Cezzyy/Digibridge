import { respondents, type schoolLinks } from '@digibridge/db'
import { eq } from 'drizzle-orm'
import type { Db } from '../config/db'
import type { Tx } from './close-attempt'

/**
 * A link's response count: the students who joined through it. A student counts from the moment
 * their profile is saved, so one whose attempt was voided still does: they can start again.
 *
 * The one definition for the public link, joining and the admin pages, so they never disagree on
 * whether a link is full. Await it for the number, or put it in a select as a subquery (pass
 * `schoolLinks.id` to count each row's link).
 */
export const linkResponses = (db: Db | Tx, linkId: typeof schoolLinks.id | string) =>
  db.$count(respondents, eq(respondents.schoolLinkId, linkId))
