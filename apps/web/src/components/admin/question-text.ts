import { DIFFICULTIES, DIFFICULTY_LABELS, ITEMS_PER_DIFFICULTY } from '@digibridge/shared'

// Words for the questions editor's pages (CMS-01 to CMS-03).

/** How many questions of each difficulty an assessment picks per area: "4 basic, 4 intermediate and 2 advanced". */
export const ASSESSMENT_MIX = new Intl.ListFormat('en', { type: 'conjunction' }).format(
  DIFFICULTIES.map((d) => `${ITEMS_PER_DIFFICULTY[d]} ${DIFFICULTY_LABELS[d].toLowerCase()}`),
)
