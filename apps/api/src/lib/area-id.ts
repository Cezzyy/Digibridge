import { competencyAreas } from '@digibridge/db'
import type { AreaCode } from '@digibridge/shared'
import { sql } from 'drizzle-orm'

/**
 * An area's id by its code, as a subquery, so it rides in the statement that needs it instead of
 * costing a query of its own. It's null for an area that was never seeded: in an UPDATE's WHERE
 * that matches nothing, and in a NOT NULL `area_id` (lessons, questions) it fails, which the
 * handlers turn into a 404 through `notNullViolation`.
 */
export const areaIdOf = (code: AreaCode) =>
  sql<string>`(select ${competencyAreas.id} from ${competencyAreas} where ${competencyAreas.code} = ${code})`
