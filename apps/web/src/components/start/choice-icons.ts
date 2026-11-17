import type { Device, InternetAccess, ONLINE_CONSENT_NOTICE } from '@digibridge/shared'

// Line icons for the start pages: the profile's answer tiles and the privacy notice's sections.
// 24 × 24 paths, drawn with a round stroke and no fill (see OptionGroup). Only decoration: the
// text next to them always says what they mean.

/** The `d` of each path in one icon. */
export type ChoiceIcon = readonly string[]

const NONE: ChoiceIcon = ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'm5.64 5.64 12.72 12.72']

export const DEVICE_ICONS = {
  smartphone: [
    'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z',
    'M11 18h2',
  ],
  laptop: [
    'M5 16V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v9',
    'M3 16h18l-1 2.5a1 1 0 0 1-.93.5H4.93a1 1 0 0 1-.93-.5Z',
  ],
  desktop: [
    'M4 3h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z',
    'M12 16v5',
    'M8 21h8',
  ],
  tablet: ['M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z', 'M12 18h.01'],
  none: NONE,
} as const satisfies Record<Device, ChoiceIcon>

export const INTERNET_ACCESS_ICONS = {
  home_wifi: [
    'M3 10.5 12 3l9 7.5',
    'M5 9v10.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9',
    'M9.5 14a3.5 3.5 0 0 1 5 0',
    'M12 17h.01',
  ],
  mobile_data: ['M5 20v-3', 'M10 20v-7', 'M15 20V9', 'M20 20V4'],
  school_wifi: [
    'M2 9.5 12 5l10 4.5-10 4.5Z',
    'M6 11.5v4.5c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5',
    'M22 9.5V15',
  ],
  piso_wifi: [
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
    'M10 17V7h2.5a2.75 2.75 0 0 1 0 5.5H10',
    'M8 9.25h8',
    'M8 11.25h8',
  ],
  none: [
    'M12 20h.01',
    'M8.5 16.5a5 5 0 0 1 7 0',
    'M5 13a10 10 0 0 1 5.2-2.7',
    'M19 13a10 10 0 0 0-2-1.5',
    'M2 9a15 15 0 0 1 4.2-2.6',
    'M22 9a15 15 0 0 0-11.3-3.8',
    'm2 2 20 20',
  ],
} as const satisfies Record<InternetAccess, ChoiceIcon>

export const IDENTITY_ICONS = {
  show: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z'],
  hide: [
    'M10.7 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.1',
    'M6.6 6.6C3.9 8.3 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6',
    'M9.9 9.9a3 3 0 0 0 4.2 4.2',
    'm2 2 20 20',
  ],
} as const satisfies Record<'show' | 'hide', ChoiceIcon>

type NoticeSectionTitle = (typeof ONLINE_CONSENT_NOTICE)['sections'][number]['title']

const CIRCLE = 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z'

/** One per privacy notice section, by title, so renaming a section asks for its icon here. */
export const NOTICE_ICONS = {
  'Who we are': [
    'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20',
    'M10 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z',
    'M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35',
    'M15.5 4.15a3.5 3.5 0 0 1 0 6.7',
  ],
  'Why we ask': [CIRCLE, 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.4', 'M12 17h.01'],
  'What we collect': [
    'M9 3h6a1 1 0 0 1 1 1v2H8V4a1 1 0 0 1 1-1Z',
    'M8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2',
    'M9 11h6',
    'M9 15h4',
  ],
  'Who sees it': IDENTITY_ICONS.show,
  'Where it’s kept': [
    'M4 6c0-1.66 3.58-3 8-3s8 1.34 8 3-3.58 3-8 3-8-1.34-8-3Z',
    'M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6',
    'M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3',
  ],
  'How we protect it': [
    'M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z',
    'M8 11V8a4 4 0 0 1 8 0v3',
    'M12 15v2',
  ],
  'How long we keep it': [CIRCLE, 'M12 7v5l3 2'],
  'Your rights': [
    'M12 3v18',
    'M7 21h10',
    'M5 7h14',
    'M5 7l-3 7a3 3 0 0 0 6 0Z',
    'M19 7l-3 7a3 3 0 0 0 6 0Z',
  ],
  'Your choice': [CIRCLE, 'm8.5 12 2.5 2.5 4.5-5'],
} as const satisfies Record<NoticeSectionTitle, ChoiceIcon>
