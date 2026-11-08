// The privacy notice respondents agree to before the profile (CON-01), under the Data Privacy
// Act of 2012. The API saves `version` with each respondent (CON-02), so change the version
// whenever the text changes. Online and kiosk have their own notice, since only kiosk asks for
// school details; the kiosk one comes with kiosk mode.

export type ConsentSection = { title: string; body: string[] }
export type ConsentNotice = { version: string; title: string; sections: ConsentSection[] }

/** Who respondents contact about their data. */
export const CONSENT_CONTACT = 'John Cez Casupanan, the group leader of the DigiBridge study'

/** Respondents' data is deleted after this (CON-01). */
export const DATA_KEPT_UNTIL = 'the end of the semester (December 2026)'

export const ONLINE_CONSENT_NOTICE = {
  version: 'online-1',
  title: 'Privacy notice',
  sections: [
    {
      title: 'Why we ask',
      body: [
        'DigiBridge is part of the study "DigiBridge: Digital Literacy Assessment Framework and Digital Inclusion" by a group of students at ACLC College of Mandaue.',
        'We use your answers to measure digital skills in three areas: finding and judging information, communicating online, and staying safe online. They also help us see which groups of people need more help.',
      ],
    },
    {
      title: 'What we collect',
      body: [
        'From Google: your name, email and profile photo, to keep your account. Never your password.',
        'From you: your name, age, sex, the devices you own and how you usually get internet.',
        'From the assessment: your answers, your scores, how long you took and, if you choose to, your rating of DigiBridge.',
      ],
    },
    {
      title: 'Who sees it',
      body: [
        'Only the DigiBridge research team. Before you start, you choose whether the team may see your name. If you say no, your name shows as Hidden to them.',
        'In the study, results are reported for groups of people, never by name.',
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
        'Taking part is up to you. If you decline, we save nothing from this form and you won’t take the assessment.',
        `To see, correct or delete your data, contact ${CONSENT_CONTACT}.`,
      ],
    },
  ],
} as const satisfies ConsentNotice
