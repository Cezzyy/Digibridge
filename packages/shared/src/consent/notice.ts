// The privacy notice respondents agree to before the profile (CON-01), under the Data Privacy
// Act of 2012. The API saves `version` with each respondent (CON-02), so change the version
// whenever the text changes. Online and school links have their own notice: the online one is
// general, for anyone on the public site, and doesn't mention a school. The school one adds the
// school details and the key the student's browser keeps. Both use the same section titles, so
// the consent page has one icon per title. A section whose every paragraph starts with a short
// label ("From Google: …") is drawn as one tile per label.
//
// Every line here must stay true of the app: where the data is kept (Supabase in AWS
// ap-south-1, Mumbai), who sees what (admins see each answer, facilitators don't, downloads are
// admin only and keep Hidden names hidden), and what an unfinished attempt does (scored when
// its time runs out).

export type ConsentSection = { title: string; body: string[] }
export type ConsentNotice = { version: string; title: string; sections: ConsentSection[] }

/** Who respondents contact about their data. */
export const CONSENT_CONTACT = 'the DigiBridge team'

/** Respondents' data, online and through school links, is deleted this many days after they
 * take part (CON-01). */
export const DATA_KEPT_DAYS = 30

/** Where the database is, for the notices (the Supabase project's region). */
const DATA_LOCATION = 'Mumbai, India'

const WHO_WE_ARE = {
  title: 'Who we are',
  body: [
    'DigiBridge is run by a student research team studying digital skills. In this notice, “we” and “the team” mean that team. We decide what DigiBridge collects and how it’s used, so we’re responsible for your data under the Data Privacy Act of 2012 (Republic Act 10173).',
    `For questions or requests about your data, contact ${CONSENT_CONTACT}.`,
  ],
}

const why = (others: string) => ({
  title: 'Why we ask',
  body: [
    'DigiBridge checks your digital skills in three areas: finding and judging information, communicating online, and staying safe online.',
    `We use your answers to show you your level in each area and lessons that fit it. Together with ${others} answers, they also show us which skills need more help, and whether things like age, devices or internet access make a difference.`,
    'In our research, we report only group results, like how many people reached each level. No one is named, and no one can be picked out from what we publish.',
    'We use your data only for this. We don’t sell it, use it for ads, or use it to decide anything else about you.',
    'We collect it because you agree to it (Section 12(a) of the Data Privacy Act). You can take that back at any time.',
  ],
})

const FROM_THE_ASSESSMENT =
  'From the assessment: the questions you got, the answers you picked, your scores and levels, when you started and finished, and, if you choose to, your rating of DigiBridge.'

const whoSees = (identity: string) => ({
  title: 'Who sees it',
  body: [
    'Admins: the researchers who run the study. They see your profile, your scores and each answer you picked, and they can download the data to analyse it.',
    'Facilitators: team members who help run sessions. They see profiles and scores, but not each answer, and they can’t download anything.',
    `Shown or hidden: before you start, you choose whether the team may see your ${identity}. If you say no, ${identity === 'name' ? 'it shows' : 'they show'} as Hidden, both in the app and in the files the team downloads.`,
    'Services we use: Supabase keeps our database and handles sign-in, Cloudflare runs the website, and Google confirms who you are if you sign in with Google. They handle your data only to run DigiBridge for us.',
    'No one else: we don’t share your data with anyone outside the team, unless the law requires it.',
  ],
})

const WHERE_KEPT = {
  title: 'Where it’s kept',
  body: [
    `Our database is on Supabase servers in ${DATA_LOCATION}, so your data is stored outside the Philippines. The Data Privacy Act still covers it there, and we stay responsible for it.`,
    'Cloudflare carries your connection to us through its network, which may pass through other countries on the way.',
    'Files the team downloads stay on the team’s own devices, never on shared or public ones.',
  ],
}

const protect = (extra: string) => ({
  title: 'How we protect it',
  body: [
    'Everything between your device and DigiBridge travels encrypted (HTTPS), and Supabase encrypts the database where it’s stored.',
    'Only the team’s accounts can see respondent data, and DigiBridge checks each person’s role every time they ask for it. Your browser can’t reach the database directly.',
    'The right answers to the questions never reach your device while you take the assessment.',
    extra,
  ],
})

const keep = (start: string) => ({
  title: 'How long we keep it',
  body: [
    `We keep your data for ${DATA_KEPT_DAYS} days after you take the assessment, then delete all of it, including any copies the team downloaded. ${start}`,
    'Only group results with no names, like how many people reached each level, stay after that, for our research.',
    'You can ask us to delete your data sooner, at any time.',
  ],
})

const RIGHTS = {
  title: 'Your rights',
  body: [
    'To know: what we collect, why and how. This notice is our answer.',
    'To see: you can ask for the data we have about you.',
    'To correct: if something about you is wrong, you can ask us to fix it.',
    'To delete or stop: you can ask us to delete your data or stop using it.',
    'To take back consent: you can change your mind at any time. It doesn’t undo what we did before.',
    'To get a copy: you can ask for your data in a file you can open.',
    'To complain: if you think we misused your data, you can contact the National Privacy Commission at privacy.gov.ph.',
    `To ask for any of these: contact ${CONSENT_CONTACT}.`,
  ],
}

const choice = (decline: string) => ({
  title: 'Your choice',
  body: [
    `Taking the assessment is up to you. ${decline}`,
    'If you stop partway, the answers you already picked are kept and scored when your time runs out.',
    'If you’re under 18, talk with a parent or guardian before you agree.',
    'If we change this notice, we’ll show you the new one and ask you to agree again before we use your data in a new way.',
  ],
})

export const ONLINE_CONSENT_NOTICE = {
  version: 'online-3',
  title: 'Privacy notice',
  sections: [
    WHO_WE_ARE,
    why('everyone else’s'),
    {
      title: 'What we collect',
      body: [
        'From Google: your name, email address and profile photo, to make and keep your DigiBridge account. Never your password.',
        'From you: your full name, date of birth, sex, the devices you own and how you usually get internet.',
        FROM_THE_ASSESSMENT,
        'On this device: your sign-in, so you stay signed in. Signing out removes it.',
      ],
    },
    whoSees('name'),
    WHERE_KEPT,
    protect('You sign in with Google, so DigiBridge never sees or keeps a password.'),
    keep(
      'That includes your DigiBridge account. If you save your profile but never start, the days count from when you saved it.',
    ),
    RIGHTS,
    choice(
      `If you decline, we save nothing from this form, and you won’t take the assessment. Only your account from signing in with Google stays, and we delete it after ${DATA_KEPT_DAYS} days, or sooner if you ask.`,
    ),
  ],
} as const satisfies ConsentNotice

// Written for students who open a link their school sent. Generic: no school is named.
export const SCHOOL_CONSENT_NOTICE = {
  version: 'school-2',
  title: 'Privacy notice',
  sections: [
    WHO_WE_ARE,
    why('other students’'),
    {
      title: 'What we collect',
      body: [
        'From you: your full name, student number, course, year level, date of birth, sex, the devices you own and how you usually get internet.',
        'From the link: which class link you opened, so we know which group you took it with.',
        FROM_THE_ASSESSMENT,
        'On this device: a key that lets this browser pick up where you left off. Choosing Done at the end removes it.',
      ],
    },
    whoSees('name and student number'),
    WHERE_KEPT,
    protect(
      'The key on your device is saved on our side only in a scrambled form (a hash), so no one can use our database to take over your assessment.',
    ),
    keep('If you save your profile but never start, the days count from when you saved it.'),
    RIGHTS,
    choice('If you decline, we save nothing from this form, and you won’t take the assessment.'),
  ],
} as const satisfies ConsentNotice
