import type { ChoiceIcon } from '../start/choice-icons'

// Line icons for the home page, drawn like the start pages' (24 × 24, round stroke, no fill).
// Only decoration: the text next to them always says what they mean.

export const ROW_ICONS = {
  rules: [
    'M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1Z',
    'M8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2',
    'm9 13.5 2 2 4-4',
  ],
  areas: ['M12 3 3 7.5 12 12l9-4.5Z', 'm3 12 9 4.5 9-4.5', 'm3 16.5 9 4.5 9-4.5'],
  levels: ['M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z', 'M8.5 12.7 7 21l5-3 5 3-1.5-8.3'],
  steps: [
    'M10 6h10',
    'M10 12h10',
    'M10 18h10',
    'M4 4.5h1.5V9',
    'M4 9h3',
    'M7 19H4l3-3.5a1.5 1.5 0 1 0-3-1',
  ],
} as const satisfies Record<string, ChoiceIcon>

export const RULE_ICONS = {
  choices: ['M10 6h10', 'M10 12h10', 'M10 18h10', 'M4.5 6h.01', 'M4.5 12h.01', 'M4.5 18h.01'],
  saved: [
    'M7 18.5a4.5 4.5 0 0 1-.7-8.95A6 6 0 0 1 17.8 8.5 4.5 4.5 0 0 1 17.5 18.5Z',
    'm9.5 13.5 2 2 3.5-3.5',
  ],
  back: ['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11'],
  timer: ['M12 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z', 'M12 9v4l2.5 1.5', 'M10 2h4'],
} as const satisfies Record<string, ChoiceIcon>
