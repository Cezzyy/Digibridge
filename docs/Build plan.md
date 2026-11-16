# DigiBridge build plan

Oct 31, 2026 · @Cornflakesxz

Tick an item when it is merged into `main` and deployed. IDs are the PRD's; file paths are the TRD's.

## Flow

Every feature is built in this order:

1. **Schema** in `packages/db` (only if the feature needs a change): edit, `pnpm db:generate`, `pnpm db:push`.
2. **Shared types** in `packages/shared`: enums, option lists or constants the web also needs.
3. **Route contract** in `apps/api/src/routes` with `createRoute`: method, path, middleware, request schema and every response status.
4. **Handler** in `apps/api/src/handlers`: the logic.
5. **Bind and mount** the route with its handler in `app.ts`.
6. **Tests** in the area's file in `apps/api/src/test/`: one for success, one for a blocked role or bad input.
7. **Web data composable** using the `hc` client.
8. **Page and components.**
9. **Ship check:** `pnpm lint`, `typecheck`, `test` and `build` all pass, then merge.

## Stage 0: Foundation

Done when you can sign in with Google on the deployed site and `/api/v1/me` answers with your admin profile.

- [x] **Monorepo:** Turborepo and pnpm workspaces with `apps/web`, `apps/api`, `packages/db`, `packages/shared`, `packages/config`.
- [x] **Supabase project:** Google provider on, redirect URLs for `localhost` and the Pages URL.
- [x] **Cloudflare resources:** Pages project `digibridge-web`, R2 bucket `digibridge-media`, Hyperdrive config `digibridge-db`, all bound in `wrangler.toml`.
- [x] **Full schema** in `packages/db`: all 11 tables and 7 enums from the TRD, the partial unique indexes (one attempt per respondent, one correct choice per question) and the 3 dashboard indexes. `db:generate`, `db:push`.
- [x] **Seeds:** `packages/db/seed/dev-questions.sql` for the 3 areas and 13 practice items per area (5 basic, 5 intermediate, 3 advanced; 5 per area can't fill the 4/4/2 mix), run in the Supabase SQL editor.
- [x] **Shared package:** enums, course and year-level lists, student number regex, scoring weights and level cut-offs.
- [x] **API skeleton:** OpenAPIHono app, error handler that returns `{ error: { code, message } }`, CORS for the Pages origin, `config/db` connection, docs in `openapi/`.
- [x] **Auth middleware and `GET /api/v1/me`:** verify the Supabase token with `jose`, create the profile on first call, `ADMIN_EMAILS` makes you admin, `requireRole` (AUTH-01, AUTH-02, AUTH-04).
- [x] **Web skeleton:** Vue Router, Pinia, Tailwind v4 tokens in `@theme`, Supabase client, `hc` client, sign in and sign out (AUTH-01, AUTH-03).
- [x] **Deploy both:** `pnpm --filter web run deploy` to Pages, `pnpm --filter api run deploy` for the API, cron trigger in `wrangler.toml`.

## Stage 1: Respondent flow

Done when a test account goes from consent to results and lessons on a phone, using dummy items. In this order:

- [x] **School details move to kiosk only:** a new migration makes `respondents.student_number`, `course` and `year_level` nullable and adds the `respondents_school_fields_by_mode` check (kiosk: all three set and no `profile_id`; online: none set). In `packages/shared`, split the profile schema into a general one and a kiosk one that adds the school fields, and update the `student-number.ts` comment, which still says unique across online and kiosk (PRO-06, KIO-03).
- [x] **Consent and profile (online):** `POST /api/v1/respondents` with the general profile only (name, date of birth, sex, devices, internet access), consent saved with the profile, show-identity choice, 400 if school fields are sent, 409 if the account already has a respondent (CON-01, CON-02, PRO-01, PRO-05 to PRO-07).
- [x] **Start an attempt:** `POST /api/v1/attempts`, pick 4 basic, 4 intermediate and 2 advanced per area, shuffle items and choices, set `expires_at`, return the in-progress attempt if there is one (ASM-01, ASM-02).
- [x] **Read and save:** `GET /api/v1/attempts/:id` without correct answers but with server time; `PUT /answers/:questionId` that checks the item and choice belong to the attempt and refuses after `expires_at` + 30 s (ASM-04, ASM-07).
- [x] **Assessment page:** switch on Start and Continue on home (`useStartAttempt` is ready), `QuestionCard`, `QuestionGrid`, Back and Next, `CountdownTimer` from server time (amber at 5 min, red at 1), saved indicator with 3 retries, submit dialog with unanswered count (ASM-03, ASM-05, ASM-06, ASM-08).
- [x] **Scoring:** `lib/scoring.ts` as a pure function with its unit tests first, then `POST /submit`, idempotent, all writes in one transaction (ASM-09).
- [x] **Cron:** `scheduled` handler in `index.ts` closes attempts past `expires_at` + 30 s as expired.
- [x] **Results page:** overall level, radar chart, score and level per area, recommended lessons, no per-item marks (RES-01 to RES-03, RES-05).
- [x] **Lessons:** public library and lesson page with Markdown rendered through DOMPurify (LES-01 to LES-03).
- [x] **SUS:** `lib/sus.ts` with its tests, `POST /api/v1/attempts/:id/sus`, `SusForm` as an optional card under results (SUS-01, SUS-02, SUS-04).

## Stage 2: School links

School links replace kiosk mode: no shared device, no exit PIN, no device lock. An admin makes a link for a class, and the team sends it only to the students they choose. Students open it on their own phone or laptop without signing in. They get the school consent notice and a profile that asks for student number, course and year level, then the same assessment, results and lessons as online. Online mode with Google sign-in stays as it is.

Done when a student opens a school link on their phone without signing in, goes from consent to results, refreshes halfway without losing their place, and a closed or expired link turns new students away. Tell Morales once this works so he can test the whole respondent side.

New requirements, replacing KIO-01 to KIO-06:

| ID     | Requirement                                                                                                                                                                  |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LNK-01 | An admin creates a school link with the school it's for, a label (such as "BSIT 2A"), an expiry, and optionally a course, a year level and a response limit, and can close it at any time. |
| LNK-02 | Anyone with the link can open it without signing in. A closed, expired or full link shows a plain message and lets no one start.                                            |
| LNK-03 | School-link students give the general profile plus student number, course and year level, all required and checked. One attempt per student number across all links.      |
| LNK-04 | A school-link student who refreshes or comes back later on the same browser picks up where they left off.                                                                  |
| LNK-05 | Each school-link attempt records the link it came from.                                                                                                                     |
| LNK-06 | After results, Done clears the student's data from the browser, so a shared phone or laptop is safe for the next student.                                                 |

In this order:

- [x] **Docs:** in the PRD, swap Kiosk mode for School links (the table above), and reword the roles table, the flow, the screens, SUS-03, RES-04, DSH-03 to DSH-06 and the risks. In the TRD, update the auth section, the `kiosk_sessions` row, the kiosk routes, guards and stores. In CLAUDE.md, update the online and kiosk rule.
- [x] **Schema:** one migration. `kiosk_sessions` becomes `school_links` (`id`, `code` random and unique for the URL, `school`, `label`, `created_by` to profiles with set null, `course` and `year_level` null for any, `max_responses` null for no limit, `expires_at`, `closed_at`, `created_at`, `.enableRLS()`). `attempts.kiosk_session_id` becomes `school_link_id`. The mode value `kiosk` becomes `school` in `MODES` and the enum. `respondents.access_token_hash` (unique when not null) is set on school rows only, and `respondents_school_fields_by_mode` checks it. drizzle-kit asks rename or drop-and-create for each change: pick rename, and check the SQL renames the enum value (`alter type ... rename value`) instead of rebuilding the type.
- [x] **Shared:** `MODES` with `school`; the kiosk profile schema renamed `schoolRespondentSchema` (general profile plus student number, course, year level limited by course); `schoolLinkSchema` for creating a link; the school consent notice in `consent/` with its own `version` (the research, the school details, Cez as group leader and contact); the respondent token header name.
- [x] **Admin links API:** `POST /api/v1/admin/links`, `GET /api/v1/admin/links` (each with its response count and whether it's open, closed, expired or full), `POST /api/v1/admin/links/:id/close`. Admin only (LNK-01).
- [x] **Open a link:** `GET /api/v1/links/:code`, no sign-in: the label and any course or year-level lock while open; 404 for an unknown code; 410 when closed, expired or full (LNK-02).
- [x] **School profile:** `POST /api/v1/links/:code/respondents`, no sign-in: the school consent version, `schoolRespondentSchema`, course and year level must match the link's lock, show-identity choice; 409 for a used student number, 410 if the link has closed. It creates a `mode = school` respondent with no `profile_id` and returns a respondent token once (32 random bytes, only the SHA-256 hash is saved) (LNK-03, PRO-02 to PRO-05).
- [x] **Respondent token on the attempt routes:** a `respondent` middleware that takes either the Google token (online) or the `X-Respondent-Token` header (school) and sets `c.var.respondent`, used by start, read, answer, submit, result and SUS. A school attempt stores `school_link_id`. Closing a link stops new students, but attempts already started can finish. Add the header to CORS. Tests: both kinds of caller, a wrong token, and a token used on someone else's attempt (LNK-04, LNK-05).
- [x] **Web:** `/s/:code` checks the link, then runs the existing start, assessment and results pages in school mode: the school notice, the profile page with the school fields (fixed when the link sets them), no Google sign-in. `stores/schoolLink.ts` keeps the code and token in `localStorage`, `lib/api.ts` sends the header when one is stored, and the `step` guard accepts a school token in place of a Google session. A closed, expired or full link shows `ErrorScreen` in plain words (LNK-02, LNK-04).
- [x] **Ending:** for school-link students the SUS form opens by itself after results (they can still skip), then Done clears the stored token and attempt (SUS-03, LNK-06).
- [x] **Links page:** `/admin/links` to make a link, copy it, see its status and response count, and close it (LNK-01).

## Stage 3: Admin side

Done when an admin can load the 30 real items by CSV and read the pilot data on the dashboard. In this order:

- [x] **Questions:** list per area, create and edit with exactly 4 choices and 1 correct, correct choice locked once answered, deactivate instead of delete (CMS-01 to CMS-03).
- [ ] **Uploads:** `POST /api/v1/admin/uploads` to the R2 `MEDIA` bucket, PNG, JPEG or WebP up to 2 MB, and `GET /api/v1/media/:key` to serve them (CMS-05).
- [ ] **CSV import:** columns from the TRD, report row errors, and the readiness check of 10 active items per area in the 4/4/2 mix (CMS-06, CMS-07). Needed before the real items can go in.
- [x] **Lessons editor:** list and Markdown editor with preview (CMS-04).
- [x] **Dashboard:** `GET /api/v1/admin/stats` with every filter, including mode and school link, summary cards including mean SUS, level chart per area, comparison chart by a chosen grouping; course and year level count school-link respondents only and say so (DSH-01 to DSH-04, SUS-05).
- [x] **Respondents:** paged table, detail drawer, Hidden for respondents who chose it, the school link's label, empty school cells for online respondents, read only for facilitators (DSH-05, DSH-07, PRO-05).
- [x] **CSV export:** admin only, follows the filters, includes SUS and the school link, keeps hidden identities hidden (DSH-06). Also as Excel, with a questions sheet and a codebook.
- [ ] **Users:** list, change role, last admin can't be demoted (USR-01, USR-02).
- [x] **Void and delete:** void an attempt with a reason; delete a respondent on request (USR-03).
- [x] **Item analysis:** percent correct per item on the questions page (DSH-08).

## Small items and backend safety

Small, fit in anywhere:

- [ ] Notice in Messenger's in-app browser on the online sign-in page: "Open in Chrome or Safari to sign in with Google." School links need no sign-in, so they work in Messenger as they are.
- [x] Error screens in plain words, no technical terms or stack traces.
- [x] Empty states: dashboard with 0 respondents, lessons not yet published, no questions in an area, no school links yet.
- [ ] Mobile pass at 360 px on every page; tap targets at least 44 px.
- [x] Landing page copy: what DigiBridge is, how long it takes, privacy line. The public pages are for online mode, so they don't mention course or year level: change the profile step in `components/landing/steps.ts` and its demo in `StepScreen.vue`, which still show them.
- [ ] Loading and saving states on every button that calls the API.

Backend safety, before the pilot. Most urgent first:

- [ ] **RLS on** for every `public` table with no policies; check the anon key can read nothing.
- [ ] **Rate limits** on the school link routes (open and profile), answer saves and CSV import.
- [x] **Secrets** only in Wrangler secrets and local env files; `.env.example` in the repo.
- [ ] **Security headers** on the API and the web.
- [ ] **Supabase settings:** only the Pages URL and `localhost` as redirect URLs.
- [ ] **Decide whether `/api/reference` stays open in prod**, with an `API_DOCS` flag.
- [x] **Dependency audit:** `pnpm audit`.

## Stage 4: Real content and freeze

Done when the database holds only real content and no test data.

- [ ] Real questions imported from the team's sheet by CSV.
- [ ] 9 lessons and the SUS wording from Gonzaga loaded.
- [ ] Practice items deactivated (IDs start with `de000000-`); readiness check passes in all 3 areas.
- [ ] Morales's QA pass; every Must bug closed.
- [ ] Device run: low-end Android on mobile data, an iPhone, a laptop, and a school link opened from Messenger.
- [ ] Feature freeze: test respondents, attempts and school links deleted, bugs only from here.

## Stage 5: Pilot and defense

- [ ] School links made for each class in the pilot, with an expiry, and sent only to the chosen students.
- [ ] Pilot with 30 or more ACLC students through school links; watch `wrangler tail` while links are open.
- [ ] Fixes deployed, read the `db:push` prompt carefully if the schema changes, Morales retests.
- [ ] Rehearsal with the live demo.
- [ ] Defense.
- [ ] End of semester: delete all respondent data, as the consent notice promises.

## Settle as we go

- **Token check:** settled. The project signs tokens with an ES256 key published at `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`, and the auth middleware verifies against it.
- **Database connection:** Hyperdrive in production; locally `wrangler dev` points the `HYPERDRIVE` binding at the session pooler string in `apps/api/.env`. If Hyperdrive fights you, use the Supabase transaction pooler and add Hyperdrive later.
- **Lost respondent token:** a school-link student who clears their browser or switches device can't get back into their attempt, and their student number now counts as used. Proposed: an admin deletes that respondent (USR-03), and the student starts again from the link.
- **Who makes school links:** admins only for now. Facilitators can view the links page later if the team wants them to.
- **Stricter checks if needed:** links are sent only by the team, and each has an expiry, an optional course and year-level lock and an optional response limit. If wrong student numbers still show up, a link could take a list of allowed student numbers.
- **Age field:** asked as date of birth, so the age stays right. Ages 10 to 99 on the day of consent, in Philippine time (`AGE_MIN`, `AGE_MAX`).
- **Finding a hidden respondent for a deletion request:** Hidden respondents can't be found in the table. Proposed: admins can search by the exact student number (school link) or the exact Google account email (online) only, and the result opens the delete and void actions without listing the name.
- **ACLC sample:** settled. The study's ACLC sample comes through school links, which need no Google sign-in and so open from Messenger. Online results are reported separately by mode.
- **Results token lifetime:** proposed: valid until respondent data is deleted at the end of the semester.
- **Exactly 4 choices:** the database allows at most 4 choices per question (positions 0 to 3, no repeats) and at most 1 correct, but it can't stop a question from having fewer than 4 or none correct. Proposed: the question create, edit and CSV import handlers check for exactly 4 choices with exactly 1 correct, and save the question and its choices in one transaction.
- **Needed from the team:** real questions, checked questions, 9 lessons and the SUS wording.
