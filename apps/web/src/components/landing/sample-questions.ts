import type { AreaCode } from '@digibridge/shared'

// Made-up items for the landing page's "Try a sample question" card, one per area.
// They aren't in the question bank and nothing is saved or scored.

export interface SampleQuestion {
  area: AreaCode
  /** Short tab label; the full name is AREA_LABELS[area]. */
  tab: string
  /** Which picture SampleQuestion.vue draws above the question. */
  scene: 'sms' | 'post' | 'chat'
  question: string
  choices: readonly [string, string, string, string]
  /** Index of the best choice. */
  answer: 0 | 1 | 2 | 3
  why: string
}

export const SAMPLE_QUESTIONS: readonly SampleQuestion[] = [
  {
    area: 'safety',
    tab: 'Safety',
    scene: 'sms',
    question: 'You get this text. What should you do?',
    choices: [
      'Tap the link and log in to check your balance.',
      'Reply with your PIN so they can confirm it’s you.',
      'Ignore the link and open your e-wallet app yourself.',
      'Call the number back and ask if it’s real.',
    ],
    answer: 2,
    why: 'Real companies don’t send login links by text. Open the official app yourself, and never share your PIN or one-time code.',
  },
  {
    area: 'info_literacy',
    tab: 'Information',
    scene: 'post',
    question: 'What’s the best way to check if this post is true?',
    choices: [
      'It has thousands of shares, so it’s probably true.',
      'Look for it on your school’s or the city’s official page.',
      'Wait and see if your classmates share it too.',
      'Share it now, then check later.',
    ],
    answer: 1,
    why: 'Lots of shares don’t make a post true. Go to the source: your school’s official page or the city government’s announcement.',
  },
  {
    area: 'communication',
    tab: 'Communication',
    scene: 'chat',
    question: 'How should your group write the report together?',
    choices: [
      'Email your parts to the leader the night before.',
      'Take turns typing on one person’s laptop.',
      'Send photos of handwritten notes in the group chat.',
      'Use one online document that everyone can edit.',
    ],
    answer: 3,
    why: 'A shared document lets everyone write and comment at the same time, and nobody has to put files together at the last minute.',
  },
]
