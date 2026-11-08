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
6. **Tests** in `app.test.ts`: one for success, one for a blocked role or bad input.
7. **Web data composable** using the `hc` client.
8. **Page and components.**
9. **Ship check:** `pnpm lint`, `typecheck`, `test` and `build` all pass, then merge.

## Stage 0: Foundation

Done when you can sign in with Google on the deployed site and `/api/v1/me` answers with your admin profile.

- [x] **Monorepo:** Turborepo and pnpm workspaces with `apps/web`, `apps/api`, `packages/db`, `packages/shared`, `packages/config`.
- [x] **Supabase project:** Google provider on, redirect URLs for `localhost` and the Pages URL.
- [x] **Cloudflare resources:** Pages project `digibridge-web`, R2 bucket `digibridge-media`, Hyperdrive config `digibridge-db`, all bound in `wrangler.toml`.
- [x] **Full schema** in `packages/db`: all 11 tables and 7 enums from the TRD, the partial unique indexes (one attempt per respondent, one correct choice per question) and the 3 dashboard indexes. `db:generate`, `db:push`.
- [ ] **Seeds:** `db:seed` for the 3 areas, `db:seed:dummy` for 5 dummy items per area.
- [x] **Shared package:** enums, course and year-level lists, student number regex, scoring weights and level cut-offs.
- [x] **API skeleton:** OpenAPIHono app, error handler that returns `{ error: { code, message } }`, CORS for the Pages origin, `config/db` connection, docs in `openapi/`.
- [x] **Auth middleware and `GET /api/v1/me`:** verify the Supabase token with `jose`, create the profile on first call, `ADMIN_EMAILS` makes you admin, `requireRole` (AUTH-01, AUTH-02, AUTH-04).
- [x] **Web skeleton:** Vue Router, Pinia, Tailwind v4 tokens in `@theme`, Supabase client, `hc` client, sign in and sign out (AUTH-01, AUTH-03).
- [x] **Deploy both:** `pnpm --filter web run deploy` to Pages, `pnpm --filter api run deploy` for the API, cron trigger in `wrangler.toml`.

## Stage 1: Respondent flow

Done when a test account goes from consent to results and lessons on a phone, using dummy items. In this order:

- [x] **School details move to kiosk only:** a new migration makes `respondents.student_number`, `course` and `year_level` nullable and adds the `respondents_school_fields_by_mode` check (kiosk: all three set and no `profile_id`; online: none set). In `packages/shared`, split the profile schema into a general one and a kiosk one that adds the school fields, and update the `student-number.ts` comment, which still says unique across online and kiosk (PRO-06, KIO-03).
- [x] **Consent and profile (online):** `POST /api/v1/respondents` with the general profile only (name, date of birth, sex, devices, internet access), consent saved with the profile, show-identity choice, 400 if school fields are sent, 409 if the account already has a respondent (CON-01, CON-02, PRO-01, PRO-05 to PRO-07).
- [ ] **Start an attempt:** `POST /api/v1/attempts`, pick 4 basic, 4 intermediate and 2 advanced per area, shuffle items and choices, set `expires_at`, return the in-progress attempt if there is one (ASM-01, ASM-02).
- [ ] **Read and save:** `GET /api/v1/attempts/:id` without correct answers but with server time; `PUT /answers/:questionId` that checks the item and choice belong to the attempt and refuses after `expires_at` + 30 s (ASM-04, ASM-07).
- [ ] **Assessment page:** switch on Start and Continue on home (`useStartAttempt` is ready), `QuestionCard`, `QuestionGrid`, Back and Next, `CountdownTimer` from server time (amber at 5 min, red at 1), saved indicator with 3 retries, submit dialog with unanswered count (ASM-03, ASM-05, ASM-06, ASM-08).
- [ ] **Scoring:** `lib/scoring.ts` as a pure function with its unit tests first, then `POST /submit`, idempotent, all writes in one transaction (ASM-09).
- [ ] **Cron:** `scheduled` handler in `index.ts` closes attempts past `expires_at` + 30 s as expired.
- [ ] **Results page:** overall level, radar chart, score and level per area, recommended lessons, no per-item marks (RES-01 to RES-03, RES-05).
- [ ] **Lessons:** public library and lesson page with Markdown rendered through DOMPurify (LES-01 to LES-03).
- [ ] **SUS:** `lib/sus.ts` with its tests, `POST /api/v1/attempts/:id/sus`, `SusForm` as an optional card under results (SUS-01, SUS-02, SUS-04).
- [ ] **QR code:** `results_token` at submit, `GET /api/v1/results/:token`, `ResultsQr` on the results page (RES-04).

## Stage 2: Kiosk mode

Done when two students in a row finish on one tablet and the second sees nothing of the first. Tell Morales once this works so he can test the whole respondent side.

- [ ] **Kiosk sessions:** `POST /api/v1/kiosk/sessions` with device label and PIN (hashed with salt), `GET` to check it's open, `POST /end` with the PIN, 5 wrong tries locks exit for 1 minute (KIO-01, KIO-05).
- [ ] **Kiosk middleware:** checks `X-Kiosk-Session` belongs to the signed-in facilitator; respondents created with `mode = kiosk` and no `profile_id`; attempts store `kiosk_session_id` (KIO-06).
- [ ] **Kiosk profile with school details:** `POST /api/v1/respondents` with `X-Kiosk-Session` takes the kiosk schema: student number regex, course, year level limited by course, all required; 409 for a used student number (KIO-03, PRO-02 to PRO-04).
- [ ] **Kiosk pages:** `/kiosk` start screen, `/kiosk/*` flow reusing the respondent pages (the profile page in kiosk mode adds the school fields), `kioskLock` guard on every route (KIO-02).
- [ ] **Kiosk ending:** SUS opens by itself after results, then Done clears the attempt store and returns to `/kiosk` (SUS-03, KIO-04).

## Stage 3: Admin side

Done when an admin can load the 30 real items by CSV and read the pilot data on the dashboard. You're back at work from Nov 4, so these are evening-sized pieces. In this order:

- [ ] **Questions:** list per area, create and edit with exactly 4 choices and 1 correct, correct choice locked once answered, deactivate instead of delete (CMS-01 to CMS-03).
- [ ] **Uploads:** `POST /api/v1/admin/uploads` to the R2 `MEDIA` bucket, PNG, JPEG or WebP up to 2 MB, and `GET /api/v1/media/:key` to serve them (CMS-05).
- [ ] **CSV import:** columns from the TRD, report row errors, and the readiness check of 10 active items per area in the 4/4/2 mix (CMS-06, CMS-07). Needed by Nov 8, when the real items arrive.
- [ ] **Lessons editor:** list and Markdown editor with preview (CMS-04).
- [ ] **Dashboard:** `GET /api/v1/admin/stats` with every filter, summary cards including mean SUS, level chart per area, comparison chart by a chosen grouping; course and year level count kiosk respondents only and say so (DSH-01 to DSH-04, SUS-05).
- [ ] **Respondents:** paged table, detail drawer, Hidden for respondents who chose it, empty school cells for online respondents, read only for facilitators (DSH-05, DSH-07, PRO-05).
- [ ] **CSV export:** admin only, follows the filters, includes SUS, keeps hidden identities hidden (DSH-06).
- [ ] **Users:** list, change role, last admin can't be demoted (USR-01, USR-02).
- [ ] **Void and delete:** void an attempt with a reason; delete a respondent on request (USR-03).
- [ ] **Item analysis:** percent correct per item on the questions page (DSH-08).

## Small items and backend safety

Small, fit in anywhere:

- [ ] Notice in Messenger's in-app browser: "Open in Chrome or Safari to sign in with Google."
- [ ] Error screens in plain words, no technical terms or stack traces.
- [ ] Empty states: dashboard with 0 respondents, lessons not yet published, no questions in an area.
- [ ] Mobile pass at 360 px on every page; tap targets at least 44 px.
- [ ] Landing page copy: what DigiBridge is, how long it takes, privacy line. The public pages are for online mode, so they don't mention course or year level: change the profile step in `components/landing/steps.ts` and its demo in `StepScreen.vue`, which still show them.
- [ ] Loading and saving states on every button that calls the API.

Backend safety, before the freeze on Nov 11. Most urgent first:

- [ ] **RLS on** for every `public` table with no policies; check the anon key can read nothing.
- [ ] **Rate limits** on answer saves, kiosk PIN and CSV import.
- [ ] **Secrets** only in Wrangler secrets and local env files; `.env.example` in the repo.
- [ ] **Security headers** on the API and the web.
- [ ] **Supabase settings:** only the Pages URL and `localhost` as redirect URLs.
- [ ] **Decide whether `/api/reference` stays open in prod**, with an `API_DOCS` flag.
- [ ] **Dependency audit:** `pnpm audit`.

## Stage 4: Real content and freeze

Done when the database holds only real content and no test data.

- [ ] Real questions imported from the team's sheet by CSV (Nov 8).
- [ ] 9 lessons and the SUS wording from Gonzaga loaded (Nov 8).
- [ ] Dummy items deactivated; readiness check passes in all 3 areas.
- [ ] Morales's QA pass; every Must bug closed (Nov 10).
- [ ] Device run: low-end Android on mobile data, an iPhone, a laptop.
- [ ] Feature freeze (Nov 11): test respondents and attempts deleted, bugs only from here.

## Stage 5: Pilot and defense

- [ ] Kiosk devices set up: facilitators signed in, a session open on each, pocket Wi-Fi or hotspot ready.
- [ ] Pilot with 30 or more ACLC students in kiosk mode (Nov 11 to 12); watch `wrangler tail` during sessions.
- [ ] Fixes deployed, read the `db:push` prompt carefully if the schema changes, Morales retests (Nov 14).
- [ ] Rehearsal with the live demo (Nov 15).
- [ ] Defense (1st week of December).
- [ ] End of semester (December): delete all respondent data, as the consent notice promises.

## Settle as we go

- **Token check:** settled Nov 7. The project signs tokens with an ES256 key published at `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`, and the auth middleware verifies against it.
- **Database connection:** Hyperdrive in production; locally `wrangler dev` points the `HYPERDRIVE` binding at the session pooler string in `apps/api/.env`. If Hyperdrive fights you on day 1, use the Supabase transaction pooler and add Hyperdrive later.
- **Kiosk resume:** if a kiosk tablet refreshes mid-attempt, the attempt ID in memory is gone. Proposed: on the kiosk start screen, entering the same student number in the same kiosk session returns the in-progress attempt.
- **Age field:** asked as date of birth, so the age stays right. Ages 10 to 99 on the day of consent, in Philippine time (`AGE_MIN`, `AGE_MAX`).
- **Finding a hidden respondent for a deletion request:** Hidden respondents can't be found in the table. Proposed: admins can search by the exact student number (kiosk) or the exact Google account email (online) only, and the result opens the delete and void actions without listing the name.
- **Messenger link for ACLC students:** online mode no longer asks for course or year level, so ACLC students who take it online won't appear in the course and year-level charts. Proposed: the team gathers the study's ACLC sample through kiosk sessions only, and online results are reported separately by mode.
- **Results token lifetime:** proposed: valid until respondent data is deleted at the end of the semester.
- **Kiosk PIN lockout:** `kiosk_sessions` has no columns to count wrong PINs, and the Worker keeps no state between requests, so "5 wrong tries locks exit for 1 minute" has nowhere to live. Proposed: in Stage 2, add `pin_failed_count` (smallint, default 0) and `pin_locked_until` (timestamptz, null) with a new migration, and store the salt inside `pin_hash` as `salt:hash`.
- **Exactly 4 choices:** the database allows at most 4 choices per question (positions 0 to 3, no repeats) and at most 1 correct, but it can't stop a question from having fewer than 4 or none correct. Proposed: the question create, edit and CSV import handlers check for exactly 4 choices with exactly 1 correct, and save the question and its choices in one transaction.
- **Needed from the team:** real questions (Nov 6), checked questions and 9 lessons (Nov 7), SUS wording (Nov 7).
