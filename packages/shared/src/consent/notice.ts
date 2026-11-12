// The privacy notice respondents agree to before the profile (CON-01), under the Data Privacy
// Act of 2012. The API saves `version` with each respondent (CON-02), so change the version
// whenever the text changes. Online and school links have their own notice: the online one is
// general, for anyone on the public site, and doesn't mention a school. The school one adds the
// school details and the key the student's browser keeps. Both use the same section titles, so
// the consent page has one icon per title.

export type ConsentSection = { title: string; body: string[] }
export type ConsentNotice = { version: string; title: string; sections: ConsentSection[] }

/** Who respondents contact about their data. */
export const CONSENT_CONTACT = 'the DigiBridge team'

/** Respondents' data is deleted after this (CON-01). */
export const DATA_KEPT_UNTIL = 'December 2026'

export const ONLINE_CONSENT_NOTICE = {
  version: 'online-2',
  title: 'Privacy notice',
  sections: [
    {
      title: 'Why we ask',
      body: [
        'DigiBridge checks your digital skills in three areas: finding and judging information, communicating online, and staying safe online.',
        'We use your answers to show you your level and lessons that fit it. Together with everyone else’s answers, they also show us which skills people need more help with.',
      ],
    },
    {
      title: 'What we collect',
      body: [
        'From Google: your name, email and profile photo, to keep your account. Never your password.',
        'From you: your name, date of birth, sex, the devices you own and how you usually get internet.',
        'From the assessment: your answers, your scores, how long you took and, if you choose to, your rating of DigiBridge.',
      ],
    },
    {
      title: 'Who sees it',
      body: [
        'Only the DigiBridge team. Before you start, you choose whether the team may see your name. If you say no, your name shows as Hidden to them.',
      ],
    },
    {
      title: 'How long we keep it',
      body: [
        `We keep your data until ${DATA_KEPT_UNTIL}, then delete all of it. You can ask us to delete it sooner.`,
      ],
    },
    {
      title: 'Your choice',
      body: [
        'Taking the assessment is up to you. If you decline, we save nothing from this form and you won’t take the assessment.',
        `To see, correct or delete your data, contact ${CONSENT_CONTACT}.`,
      ],
    },
  ],
} as const satisfies ConsentNotice

/** School-link respondents' data is deleted this many days after they take part (CON-01). */
export const SCHOOL_DATA_KEPT_DAYS = 30

// Generic wording for now, written for students who open a link their school sent.
export const SCHOOL_CONSENT_NOTICE = {
  version: 'school-1',
  title: 'Privacy notice',
  sections: [
    {
      title: 'Why we ask',
      body: [
        'DigiBridge checks your digital skills in three areas: finding and judging information, communicating online, and staying safe online.',
        'We use your answers to show you your level and lessons that fit it. Together with other students’ answers, they also show us which skills students need more help with.',
      ],
    },
    {
      title: 'What we collect',
      body: [
        'From you: your name, student number, course, year level, date of birth, sex, the devices you own and how you usually get internet.',
        'From the assessment: your answers, your scores, how long you took and, if you choose to, your rating of DigiBridge.',
        'On this device: a key that lets this browser pick up where you left off. Choosing Done at the end removes it.',
      ],
    },
    {
      title: 'Who sees it',
      body: [
        'Only the DigiBridge team. Before you start, you choose whether the team may see your name and student number. If you say no, they show as Hidden to them.',
      ],
    },
    {
      title: 'How long we keep it',
      body: [
        `We keep your data for ${SCHOOL_DATA_KEPT_DAYS} days, then delete all of it. You can ask us to delete it sooner.`,
      ],
    },
    {
      title: 'Your choice',
      body: [
        'Taking the assessment is up to you. If you decline, we save nothing from this form and you won’t take the assessment.',
        `To see, correct or delete your data, contact ${CONSENT_CONTACT}.`,
      ],
    },
  ],
} as const satisfies ConsentNotice
