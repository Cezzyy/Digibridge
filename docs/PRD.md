# DigiBridge PRD

Oct 30, 2026 · @Cornflakesxz

## Overview

DigiBridge is a web app that measures the digital literacy of ACLC College of Mandaue students in 3 DigComp 2.2 areas, shows each student their level and matching lessons right after they finish, and gives the research team a dashboard of who is falling behind. It is the working prototype for the study *DigiBridge: Digital Literacy Assessment Framework and Digital Inclusion*.

**Problem.** Students are assumed to be "digital natives," but skills like spotting phishing texts, judging fake news or using online forms vary widely, and nobody measures it. Without data, the school can't tell which students need help or in what skill.

**What it does:**

- Runs a 30-item, scenario-based assessment across Information and data literacy, Communication and collaboration, and Online safety.
- Works two ways:
  - **Online (public):** anyone opens the site and signs in with Google. They answer general questions only (name, date of birth, sex, devices, internet access). No school details are asked.
  - **School links:** an admin makes a link for a class, and the team sends it only to the students they choose. Students open it on their own phone or laptop without signing in. This is the only mode that asks for school details: student number, course and year level. The study's ACLC data comes from school links.
- Scores each area into one of 4 levels and recommends lessons that live inside the app.
- Gives admins and facilitators a dashboard broken down by age, sex and device or internet access for everyone, and by course and year level for school-link respondents. This is the digital inclusion view the paper needs.

**Built by:** Cez (sole developer), with Morales on QA and the rest of Group 2 on content, interviews and the pilot test.

**Two modes, one rule.** Everything tied to a school (student number, course, year level, the one-attempt-per-student-number check) lives in school links. Online mode is general and open to anyone, with one attempt per Google account. This keeps the public site usable by people outside ACLC and keeps the school details with the links the team sends to chosen students.

**After the study.** Cez may later grow DigiBridge into a product where schools and other institutions pay to run school links for their own students. That is out of scope for this phase. The only thing this phase does for it is keep school details in school links and in `packages/shared`, so other schools could get their own lists later without changing the online side.

## Goals and success metrics

The prototype succeeds if real students can finish the assessment without help and the team gets clean data for the paper and defense.

| Goal | Metric | Target |
| --- | --- | --- |
| Enough respondents for the study | Completed assessments during the pilot | 30 or more |
| Easy to use | Mean SUS score from pilot respondents | 68 or higher (above average) |
| Students finish what they start | Completed attempts ÷ started attempts | 90% or more |
| Fits a short in-person session | Median time to finish the assessment | 20 minutes or less |
| Instant feedback | Results and lessons shown after submit | Under 2 seconds |
| Reliable data | Attempts lost or double-counted | 0 |
| Answers the research question | Dashboard breakdowns available | By age, sex, device and internet access for all respondents; by course and year level for school-link respondents |

## Scope

The prototype covers one assessment per student, instant results with lessons, and an admin side to manage content and read the data.

**In scope**

- Google sign-in for online respondents, facilitators and admins
- Online mode open to anyone, with a general profile and no school details
- School links that admins make per class and the team sends to chosen students, opened on the student's own phone or laptop with no Google account, the only place student number, course and year level are asked
- Data privacy consent and a respondent profile before the assessment, with a choice to hide name (and, through a school link, student number) from the team
- 30-item timed assessment with shuffling, autosave and back navigation
- Weighted scoring into 4 levels per area, plus an overall level
- Results page with a radar chart, recommended lessons and a QR code to reopen results
- In-app SUS usability survey after results
- Lessons library inside the app
- Admin dashboard with charts, filters and CSV export
- In-app management of questions, lessons and user roles

**Out of scope**

- The other 2 DigComp areas: digital content creation and problem solving
- Retakes (one attempt per Google account online, one per student number across all school links)
- School details (student number, course, year level) in online mode
- More than one school: other schools' student number formats and course lists, accounts per school, and paid plans for institutions (a possible product after the study)
- Cebuano and Filipino translations
- Offline mode and installable PWA
- Native Android or iOS apps
- Adaptive testing that changes questions based on earlier answers
- Email or SMS notifications

## Users and roles

Three roles sign in with Google; school-link respondents never sign in.

| User | Signs in? | Can do | Who |
| --- | --- | --- | --- |
| Respondent, online | Yes, Google | Consent, fill the general profile (no school details), take the assessment once per Google account, see own results and lessons | Anyone who opens the public site |
| Respondent, school link | No | Open the link on their own device, consent, fill the general profile plus student number, course and year level, take the assessment once per student number, see results and lessons; Done clears them from the browser | ACLC students the team sends a link to |
| Facilitator | Yes, Google | View the dashboard and respondents (read only) | Group 2 members running sessions |
| Admin | Yes, Google | Everything: dashboard, school links, CSV export, manage questions, lessons and users, assign roles | Cez (and anyone Cez promotes) |

A new Google account starts as a respondent. Only an admin can promote someone to facilitator or admin.

## User flow

&#91;embedded content: Respondent flow · online and school link entry\]

Both entry paths join at consent, then split at the profile: online asks only the general fields, a school link adds the school fields. Declining ends the flow before any assessment data exists. Online, an account that already has an attempt goes to its results. Through a school link, the student's browser keeps their place, so a refresh or a later visit carries on; a student number that's already used is stopped; and Done after results clears the student from the browser. A closed, expired or full link turns new students away.

## Functional requirements

Every requirement has an ID that Morales's test cases point to. Must = needed for the pilot, Should = needed for the defense, Could = only if time allows.

### Sign-in and roles

| ID | Requirement | Priority |
| --- | --- | --- |
| AUTH-01 | Users sign in with Google. | Must |
| AUTH-02 | A new account is a respondent. Emails listed in the admin bootstrap setting become admins on first sign-in. | Must |
| AUTH-03 | Users can sign out from any page. | Must |
| AUTH-04 | Pages and API routes are blocked for roles that shouldn't reach them. | Must |

### School links

School links replaced kiosk mode (KIO-01 to KIO-06): no shared device, no exit PIN, no device lock.

| ID | Requirement | Priority |
| --- | --- | --- |
| LNK-01 | An admin creates a school link with the school it's for, a label (such as "BSIT 2A"), an expiry, and optionally a course, a year level and a response limit, and can close it at any time. | Must |
| LNK-02 | Anyone with the link can open it without signing in. A closed, expired or full link shows a plain message and lets no new student in. A student counts against the limit once their profile is saved, and can then finish even if the link closes. | Must |
| LNK-03 | School-link students give the general profile plus student number, course and year level, all required and checked (PRO-02 to PRO-04); a link made for one course or year level fills it in. One attempt per student number across all links. School links are the only place these school details are asked. | Must |
| LNK-04 | A school-link student who refreshes or comes back later on the same browser picks up where they left off. | Must |
| LNK-05 | Each school-link respondent and attempt records the link it came from. | Must |
| LNK-06 | After results, Done clears the student's data from the browser, so a shared phone or laptop is safe for the next student. "Not you?" in the top bar does the same for someone who finds another student's place open. | Must |

### Consent and profile

| ID | Requirement | Priority |
| --- | --- | --- |
| CON-01 | Before anything else, respondents see a consent notice under the Data Privacy Act of 2012: purpose, data collected, who sees it, who handles it for us (Supabase, Cloudflare, Google), where it's stored (Mumbai, India), how it's protected, how long it's kept before it's deleted (30 days after taking part, online and school links alike), the respondent's rights under the Act, and the DigiBridge team as contact. They must agree to continue. | Must |
| CON-02 | The app stores the consent with its timestamp and notice version. Declining ends the flow without saving anything. | Must |
| PRO-01 | General profile, asked in both modes: full name, date of birth (age from 10 to 99, worked out from it in Philippine time), sex, devices they own, and how they usually get internet. | Must |
| PRO-05 | Before starting, respondents choose whether the team may see who they are: their name, and through a school link also their student number. If they say no, these show as Hidden on the dashboard and in the CSV, and only the other profile answers are shown. | Must |
| PRO-06 | Online respondents are never asked for a student number, course or year level, and the API refuses them if sent. | Must |
| PRO-07 | Online, one respondent and one attempt per Google account. An account that already has an attempt goes to its results instead of a new profile. | Must |

**School details (school links only)**

Through a school link the profile also asks for student number, course and year level, and all three are required there (LNK-03).

| ID | Requirement | Priority |
| --- | --- | --- |
| PRO-02 | Student number must match the ACLC format, for example C23-01-7557-MAN121: 1 letter and 2 digits, 2 digits, 4 digits, then 3 letters and 3 digits, separated by dashes. It is saved in uppercase and is unique among school-link respondents. | Must |
| PRO-03 | A student number that's already used is stopped with a clear message. | Must |
| PRO-04 | Course choices: BSIT, BSCS, BSBA, BSA and BSHM (1st to 4th year), and TESDA scholars in HRT and WADT (1st to 3rd year). The year-level options change with the course picked. | Must |

### Assessment

| ID | Requirement | Priority |
| --- | --- | --- |
| ASM-01 | 30 items, 10 per area, one item per screen, 4 choices each. | Must |
| ASM-02 | Item order and choice order are shuffled per attempt and stay the same after a reload. | Must |
| ASM-03 | A 25-minute countdown is always visible. At 0 the attempt submits itself. | Must |
| ASM-04 | Each answer saves as soon as it's picked. | Must |
| ASM-05 | Respondents can go back, change answers, and jump using a question grid that marks answered and unanswered items. | Must |
| ASM-06 | Scenario items show an image, such as a screenshot of a suspicious SMS. | Must |
| ASM-07 | A refresh or dropped connection resumes the same attempt with saved answers, as long as time remains. | Must |
| ASM-08 | Submitting asks for confirmation and shows how many items are unanswered. | Must |
| ASM-09 | The timer is kept by the server. Closing the page does not pause it. | Must |

### Results and lessons

| ID | Requirement | Priority |
| --- | --- | --- |
| RES-01 | Results appear right after submit: overall level, level and score per area, and a radar chart of the 3 areas. | Must |
| RES-02 | Each area shows recommended lessons matched to the respondent's level in that area. | Must |
| RES-03 | Online respondents can return to their results at any time. | Must |
| RES-04 | The results page shows a QR code to a private results link, so school-link respondents can reopen their results and lessons after Done or on another device. Online respondents can show it too. | Should |
| RES-05 | Results do not reveal which items were right or wrong, so answers don't spread between students. | Must |
| LES-01 | A lessons library holds 9 lessons: 3 areas × 3 lesson levels. | Must |
| LES-02 | A lesson has a title, area, level, body text, optional image, optional video link and optional outside resources. | Must |
| LES-03 | The lessons library is readable without signing in. | Should |

### Usability survey (SUS)

| ID | Requirement | Priority |
| --- | --- | --- |
| SUS-01 | After results, respondents can answer the 10 System Usability Scale statements, each rated 1 (Strongly disagree) to 5 (Strongly agree). | Must |
| SUS-02 | Online, the survey is optional: a Rate DigiBridge card under the results, with a Skip option. | Must |
| SUS-03 | Through a school link, Done opens the survey before it clears the student, if it isn't answered yet. The team encourages it, but the student can still skip. | Must |
| SUS-04 | The app computes the SUS score (0 to 100) and stores it with the attempt. One SUS response per attempt. | Must |
| SUS-05 | The dashboard shows the mean SUS score, the number of responses and how scores spread; the CSV includes each SUS score. | Must |

### Admin dashboard

| ID | Requirement | Priority |
| --- | --- | --- |
| DSH-01 | Summary cards: respondents, completion rate, average overall score, average score per area, median time taken, mean SUS score. | Must |
| DSH-02 | Chart of how many respondents reached each level, per area. | Must |
| DSH-03 | Filters for sex, age group, devices owned, internet access, mode (online or school link), school link and date range, plus course and year level. Course, year level and link exist only for school-link respondents, so picking any of them shows school-link respondents only. All charts and cards follow the filters. | Must |
| DSH-04 | Comparison chart of average score by a chosen grouping, such as by internet access or by mode. Grouping by course, year level or school link uses school-link respondents only, and the chart says so. | Must |
| DSH-05 | Respondents table with search and sort, and a detail view of one respondent's profile and area scores. Name and student number appear only for respondents who allowed it (PRO-05). Online respondents have no student number, course, year level or school link, so those cells are empty. | Must |
| DSH-06 | Export the filtered respondents with profile, area scores, levels and SUS score as CSV or Excel (with a codebook), keeping hidden identities hidden, with each respondent's school link. Student number, course, year level and link are empty for online respondents. Admin only. | Must |
| DSH-07 | Facilitators can view the dashboard and respondents but cannot export or change anything. | Should |
| DSH-08 | Item analysis: percent of respondents who got each item right, to spot items that are too easy, too hard or confusing. | Should |

### Content management

| ID | Requirement | Priority |
| --- | --- | --- |
| CMS-01 | Admins add, edit and deactivate questions: area, difficulty, question text, optional image, 4 choices, correct choice, explanation. | Must |
| CMS-02 | A question that has been answered can't be deleted or have its correct choice changed. It can only be deactivated, so past scores stay valid. | Must |
| CMS-03 | Saving a question checks there are exactly 4 choices and exactly 1 correct. | Must |
| CMS-04 | Admins add and edit lessons with a Markdown editor and preview. | Must |
| CMS-05 | Admins upload images for questions and lessons. | Must |
| CMS-06 | Admins import questions from a CSV exported from the team's Google Sheet. | Should |
| CMS-07 | The assessment can't start unless each area has at least 10 active questions with the 4 basic, 4 intermediate, 2 advanced mix. | Should |

### User management

| ID | Requirement | Priority |
| --- | --- | --- |
| USR-01 | Admins see all accounts with name, email, role and last sign-in. | Must |
| USR-02 | Admins change a role between respondent, facilitator and admin. The last admin can't be demoted. | Must |
| USR-03 | Admins can delete a respondent's data when the respondent asks, as the Data Privacy Act allows. | Should |

## Assessment and scoring rules

Each area is worth 18 points, harder items count more, and the percentage sets one of 4 levels.

**Items per area**

| Difficulty | Items | Points each | Points |
| --- | --- | --- | --- |
| Basic | 4 | 1 | 4 |
| Intermediate | 4 | 2 | 8 |
| Advanced | 2 | 3 | 6 |
| **Total per area** | **10** |  | **18** |

At least 3 of the 10 items in each area are scenario items with an image.

**Scores**

- Area score = points earned in the area ÷ 18 × 100.
- Overall score = points earned in all areas ÷ 54 × 100.
- An unanswered item earns 0 points.

**Levels** (used for each area and for the overall score)

| Score | Level | Lessons recommended |
| --- | --- | --- |
| Below 40% | Beginner | Foundations lesson |
| 40% to 59% | Basic | Foundations lesson, then Intermediate as the next step |
| 60% to 79% | Intermediate | Intermediate lesson, then Advanced as the next step |
| 80% and up | Advanced | Advanced lesson |

Example: a student gets all 4 basic, 2 intermediate and 1 advanced item right in Online safety. That's 4 + 4 + 3 = 11 of 18, or 61%, so Intermediate.

**Attempt rules**

- One attempt per Google account online (PRO-07), and one attempt per student number across all school links (PRO-03). The two aren't linked: online has no student number to match against.
- 25 minutes from the moment the attempt starts. At 0 it submits with whatever is saved.
- Answers can be changed until submit or time out.
- An admin can void an attempt that failed for technical reasons, with a reason recorded. A voided attempt is left out of all stats, and the student can start again.

## Screens

Screens in three groups: respondent, school link and admin.

| Screen | Route | Who | What's on it |
| --- | --- | --- | --- |
| Landing | / | Signed out | What DigiBridge is, Get started (to sign in), link to lessons |
| Sign in | /sign-in | Signed out | Continue with Google; the first sign-in makes the account |
| Home | /home | Signed in | Respondents: the next step. Before the attempt: 30 items, 25 minutes, can go back, what it checks, the 4 levels, Start; then Continue or the way to results. Staff: a preview of the student steps |
| Consent | /start/consent | Respondent | Data Privacy Act notice, Agree and Decline buttons |
| Profile | /start/profile | Respondent | Name, date of birth, sex, devices, internet access, show-my-identity choice (no school details) |
| Assessment | /assessment | Respondent | One item, 4 choices, timer, Back and Next, question grid, Submit |
| Results | /results | Respondent | Overall level, radar chart, score and level per area, recommended lessons, QR code, Rate DigiBridge card |
| Usability survey | /feedback | Respondent | 10 SUS statements on a 1 to 5 scale, Submit and Skip |
| Privacy | /privacy | Everyone | Both privacy notices (Google sign-in and school links) and the contact; linked from the landing page and sign in |
| Lessons library | /lessons | Everyone | Lessons grouped by area and level |
| Lesson | /lessons/:slug | Everyone | Lesson body, image or video, resources |
| School link | /s/:code → /s/:code/results | School-link respondent | The school notice, profile with the school details (student number, course, year level), home with the rules, assessment, results with the Rate DigiBridge card and Done (which opens the survey first if it isn't answered); a closed, expired or full link shows a plain message instead |
| Done | /s/:code/done | School-link respondent | Thanks, the browser is cleared, link to the lessons |
| School links | /admin/links | Admin | Make a link, copy it, see its status and how many joined, close it |
| Dashboard | /admin | Admin, facilitator | Summary cards incl. mean SUS, level chart, comparison chart, filters |
| Respondents | /admin/respondents | Admin, facilitator | Table with search, sort and filters; detail drawer; Export CSV (admin) |
| Questions | /admin/questions | Admin | List per area, editor, CSV import, item analysis |
| Lessons editor | /admin/lessons | Admin | List and Markdown editor with preview |
| Users | /admin/users | Admin | Accounts and roles |

All screens work at phone width (360 px) and up. The assessment and school-link screens use large tap targets, since students use their own phones.

## Non-functional requirements

The app must work on a cheap phone over mobile data and keep student data private.

| Area | Requirement |
| --- | --- |
| Performance | First load under 3 seconds on a 4G phone. Saving an answer under 500 ms. Results under 2 seconds after submit. |
| Devices | Works on Android Chrome, iOS Safari and desktop Chrome or Edge, from 360 px wide. Tested on at least one low-end Android phone. |
| Reliability | No answer is lost on refresh, lost signal or closed tab. The app stays up through the pilot (Nov 11 to 12) and the defense. |
| Capacity | 30 respondents taking the assessment at the same time without slowdown. |
| Accessibility | Body text at least 16 px, color contrast at WCAG AA, every control usable by keyboard, choices are real radio buttons. |
| Privacy | Follows the Data Privacy Act of 2012: consent first, only the fields the study needs, respondent data visible only to the team, deletion on request, respondent data, online and school links, deleted 30 days after they take part. |
| Security | HTTPS only. Every API route checks the role. The database can't be reached directly from the browser. |
| Language | English for this version, written plainly for students. |

## Release plan

The system is built over Oct 31 to Nov 3, filled with real content by Nov 8, and frozen on Nov 11 for the pilot.

| Date | Milestone | Done when |
| --- | --- | --- |
| Nov 1 | Repo, Supabase project, Google sign-in working | Cez signs in on the deployed site |
| Nov 2 | Schema, migrations and dummy seed data | 5 dummy items per area load in the assessment |
| Nov 3 | All features working end to end with dummy content | A test respondent goes online and through a school link, consent to results; dashboard shows them |
| Nov 3 | Morales's test cases written | One test case per Must requirement |
| Nov 6 | Real questions written | 30 items in the shared sheet |
| Nov 7 | Questions reviewed, lessons written | Gonzaga signs off; 9 lessons ready |
| Nov 8 | Real content loaded | CSV import done; dummy content deactivated |
| Nov 10 | QA pass on every feature | No open Must bugs |
| Nov 11 | Feature freeze, full test, test data cleared | Database holds only real content, no test respondents |
| Nov 11 to 12 | Pilot test with 30 or more ACLC students, through school links | 30 completed school-link attempts and SUS forms |
| Nov 14 | Bug fixes deployed and retested | Morales signs off |
| Nov 15 | Rehearsal with live demo | Full run-through without errors |
| 1st week of Dec | Defense |  |

## Decisions

The open questions are settled; each answer is built into the requirements above.

- **School details only through school links** (Nov 7, links from Nov 11): student number, course and year level are asked only through school links. Online mode is public and general, with one attempt per Google account (PRO-06, PRO-07, LNK-03). The study's ACLC sample comes through school links, which need no Google sign-in and so open from Messenger.
- **School links replace kiosk mode** (Nov 11): students use their own devices, so there's no shared tablet, exit PIN or device lock. A student counts against a link's limit once their profile is saved, and can finish after the link closes (LNK-02). A student number already used is stopped with a message to ask the team; there's no way to recover a lost place on another browser in this phase (PRO-03).
- **Student number format:** like C23-01-7557-MAN121, school links only (PRO-02).
- **Courses and year levels:** BSIT, BSCS, BSBA, BSA and BSHM for 1st to 4th year; TESDA scholars in HRT and WADT for 1st to 3rd year, school links only (PRO-04).
- **Consent contact and retention:** both notices name the DigiBridge team as contact, not a person. Data from both modes is kept for 30 days after the respondent takes part, then deleted; only group results with no names stay for the paper (CON-01).
- **SUS survey:** inside the app after results. Optional online, offered again by Done through a school link (SUS-01 to SUS-05). This replaces the separate Google Form.
- **QR code to results:** included (RES-04).
- **Showing identity:** each respondent chooses before the assessment whether the team sees their name and, through a school link, their student number (PRO-05).
