import type { AreaCode } from '@digibridge/shared'

/** What each area checks, in words for students. Shown on the landing page and home. */
export const AREA_DETAILS: Record<AreaCode, { summary: string; topics: string[] }> = {
  info_literacy: {
    summary: 'Finding what you need online, and knowing whether you can trust it.',
    topics: ['Searching smarter', 'Telling real news from fake', 'Keeping files and data in order'],
  },
  communication: {
    summary: 'Working with others online, and knowing how to act in chats, groups and classes.',
    topics: [
      'Working on shared files',
      'Netiquette in chats and classes',
      'Your digital footprint',
    ],
  },
  safety: {
    summary: 'Keeping your accounts, your devices, your personal data and yourself safe.',
    topics: [
      'Scam texts and fake links',
      'Passwords and privacy settings',
      'Screen time and wellbeing',
    ],
  },
}
