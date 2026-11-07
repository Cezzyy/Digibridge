# CLAUDE.md

Guide for Claude Code in this repo. Read the docs below before changing anything.

## Project

DigiBridge is a web app that measures the digital literacy of ACLC College of Mandaue students in 3 DigComp 2.2 areas, shows each student their level and matching lessons, and gives the research team a dashboard of who is falling behind. Cez is the sole developer; Morales does QA.

- [docs/PRD.md](docs/PRD.md): what to build. Requirement IDs (AUTH-01, ASM-03, ...) are used by tests, commits and bug reports.
- [docs/TRD.md](docs/TRD.md): how to build it: architecture, data model, API, assessment engine, security.
- [docs/Build plan.md](<docs/Build plan.md>): order of work and stage checklists.

## Status

Stage 0. Workspaces, TypeScript, ESLint, Prettier, a Husky pre-commit hook and GitHub Actions CI are set up. `pnpm dev` serves the web app at http://localhost:5173 and the API at http://localhost:8787.

API: an `OpenAPIHono` app with `GET /api/v1/health` and `GET /api/v1/me`, the spec at `/api/openapi.json` and the docs page at http://localhost:8787/api/reference. `middleware/` has CORS (only `WEB_ORIGIN`), `db` (sets `c.var.db` from `createDb(env)` on every `/api/v1` request), `auth` (verifies the Supabase token with `jose` against the project's ES256 JWKS, then loads or creates the profile through `lib/profile.ts` and sets `c.var.profile`), `requireRole(...roles)` and the error handler: every error is `{ error: { code, message } }`, thrown as `new ApiError(code, message)`; routes list error responses with `errorResponse()` from `openapi/`. A route that needs sign-in puts `middleware: [auth, requireRole(...)] as const` and `security: [{ Bearer: [] }]` in its `createRoute`, and its handler is typed `RouteHandler<typeof route, AuthEnv>`. Route tests are in `apps/api/src/app.test.ts` (`pnpm --filter api test`), with `test-helpers.ts` for the test database and signed-in users.

Web: Vue Router (`router.ts`, guards from `meta.requires`: `guest`, `signedIn`, `staff`, `admin`), Pinia (`stores/session.ts`: Supabase session, `/me` result, sign in and out), `lib/supabase.ts` (PKCE, sign-in only), `lib/api.ts` (typed `hc` client for `/api/v1` plus `call()`, which returns the JSON body or throws `ApiRequestError` with the API's code), Tailwind v4 with the `docs/design.md` tokens in `src/style.css`, and Bricolage Grotesque (headings) and Source Sans 3 (body) self-hosted through Fontsource. Pages: landing (`/`), sign in (`/sign-in`, Google; the first sign-in makes the account), home (`/home`, placeholder) and not found (`ErrorScreen`, no `AppHeader`). Landing and sign in set `meta.hideHeader` and share `SiteHeader`, `SwashWord` and the landing `BridgeArt` instead of `AppHeader` (only landing has `SiteFooter`; sign in fits on one screen, using the `short:` and `tall:` screen-height variants from `style.css`); the steps list in `components/landing/steps.ts` feeds both. Signed-in users who open `/` or `/sign-in` go to `/home`, including on the way back from Google. Until the first page resolves (the guards wait for the session and `/me`), `App.vue` shows `AppSplash` ("Signing you in" on the way back from Google) instead of a blank screen. `ErrorScreen` (title, message, actions; the first action is the main button) is the one screen for anything that stops a page: not found, and `session.failure`, which `App.vue` shows over the page when the return from Google doesn't end signed in (`sign-in`) or `/me` fails for any reason but `unauthorized` (`unavailable`). The router guard drops Google's `?code=`/`?error=` leftovers from the URL, and moving to another page closes the error screen (in `afterEach`, so a link to the page already open closes it too). `AccountControls` (picture, name, Sign out) sits in both `AppHeader` and `ErrorScreen`'s top bar, so signed-in users can sign out from every page.

Database: the full schema (11 tables, 7 enums, RLS on every table) is in `packages/db/src/schema` and pushed to Supabase as `supabase/migrations/*.sql`; the enum values come from `packages/shared/src/enums/values.ts`. `packages/shared/src` has one folder per topic, each with an `index.ts` that re-exports it: `enums/` (the enum values, their Zod schemas and labels, `STAFF_ROLES`), `errors/` (the API's error codes), `profile/` (student number regex, courses and their year levels, devices, internet access) and `assessment/` (assessment rules, scoring weights, level cut-offs, lesson tiers per level and SUS constants), with Vitest tests (`pnpm --filter @digibridge/shared test`). Other folders hold a placeholder `index.ts`.

## Commands

```sh
pnpm install
pnpm dev                                      # web on :5173 (Vite), api on :8787 (wrangler dev)
pnpm build | lint | typecheck | test          # Turborepo, every package
pnpm check                                    # lint + typecheck + test + build (ship check)
pnpm format | format:check                    # Prettier
pnpm db:generate                              # drizzle-kit: schema changes -> supabase/migrations/*.sql
pnpm db:push                                  # supabase db push: apply new migrations to the linked project
pnpm db:status                                # supabase migration list: local vs remote
pnpm --filter web run deploy                  # build + wrangler pages deploy -> https://digibridge-web.pages.dev
pnpm --filter api run deploy                  # wrangler deploy -> https://digibridge-api.casupananjohncez.workers.dev
pnpm --filter <name> <script>                 # one package: web, api, @digibridge/db, @digibridge/shared, @digibridge/config
```

## Layout

| Path              | What                                                                      |
| ----------------- | ------------------------------------------------------------------------- |
| `apps/web`        | Vue 3 SPA, deployed to Cloudflare Pages                                   |
| `apps/api`        | Hono + OpenAPI on Cloudflare Workers; the only code that touches Postgres |
| `packages/db`     | Drizzle schema, seeds and `drizzle.config.ts`                             |
| `packages/shared` | Zod enums, option lists and scoring constants used by web and api         |
| `packages/config` | Shared ESLint rules (`eslint/`), used by the root `eslint.config.ts`      |
| `supabase`        | Supabase CLI project (`config.toml`) and the SQL `migrations/`            |

At the root: `tsconfig.base.json` (shared TypeScript settings; every package's `tsconfig.json` extends it with `../../tsconfig.base.json`), `eslint.config.ts` (one lint config for the repo, rules from `packages/config`), `.prettierrc`, `turbo.json`, and `pnpm-workspace.yaml` (workspaces and the version catalog). `.husky/pre-commit` runs lint-staged (its config is the `lint-staged` key in the root `package.json`). `.github/workflows/ci.yml` runs on every push to `main` or `develop` and every pull request: Format, Lint, Typecheck, Test and Build as separate jobs (Turbo cache kept between runs), plus Dependency audit (`pnpm audit --audit-level high`), Secret scan (gitleaks) and Workflow lint (actionlint). Every job installs through `.github/actions/setup`.

## Rules

- TypeScript everywhere, including config files (`eslint.config.ts`, `vite.config.ts`, `drizzle.config.ts`). No `.js` or `.mjs` files.
- Build each feature in the Build plan's order: schema, shared types, route contract, handler, bind in `app.ts`, tests, web composable, page, ship check.
- Work in small steps and check with the user before starting the next stage.
- The browser talks to Supabase only to sign in. Everything else goes through the API, which checks the role on every route.
- Scoring numbers, enums and option lists live in `packages/shared`. Don't hard-code them anywhere else.
- School details (student number, course, year level) belong to kiosk mode only. Online mode (public Google sign-in, landing and sign-in pages) is general: it never asks for or shows them, and the API refuses them. Online is one attempt per Google account; kiosk is one per student number.
- `apps/web` imports only types from `apps/api` (`import type`), never runtime code.
- Internal packages are used as TypeScript source (`exports` point at `src/*.ts`), with no build step.
- A dependency used by more than one package gets its version in the `catalog:` in `pnpm-workspace.yaml`.
- Secrets never go in the repo, only `.env.example` and `.dev.vars.example`. Local values live in `apps/web/.env`, `packages/db/.env`, `apps/api/.dev.vars` and `apps/api/.env`. Add a new API variable to `.dev.vars.example` and the `Bindings` type in `apps/api/src/env.ts`.
- User-facing text is plain English, written for students.

## Versions and gotchas

- TypeScript is pinned to `~6.0`, because typescript-eslint supports only below 6.1. TS 6 defaults `types` to `[]`, so list the types each tsconfig needs. `baseUrl` is deprecated; use `paths` on its own.
- Use Vitest 4.1, not 5: Vitest 5 doesn't support Node 25.
- Use `postgres` (postgres.js) 3.4.x. 4.0 was only days old on 2026-10-31.
- pnpm 12 holds back versions published in the last day (`minimumReleaseAge`). Approve packages that need install scripts with `pnpm approve-builds`.
- ESLint loads `eslint.config.ts` through `jiti`, a root devDependency.
- `web` type-checks with `vue-tsc`, not `tsc`, so `.vue` files are checked.
- API routes live under `/api/v1`; the spec and docs page stay at `/api`. Define each route with `createRoute` in `routes/` and bind it to the `v1` app with `.openapi()` in `app.ts`, so it shows up in `/api/reference`.
- The API's bindings are in `wrangler.toml`: `HYPERDRIVE` (config `digibridge-db`, Supabase direct connection) and `MEDIA` (private R2 bucket `digibridge-media`, images served by the API). `wrangler dev` connects `HYPERDRIVE` to `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` in `apps/api/.env` and uses a local stand-in for R2. The API type-checks against `@cloudflare/workers-types`, not DOM.
- Deploy with `pnpm --filter <app> run deploy`, not `pnpm --filter <app> deploy` (that's pnpm's own `deploy` command). Pages is a direct-upload project, so pushing to `main` doesn't deploy the web app. The API's public settings are `[vars]` in `wrangler.toml`; its secrets are set with `wrangler secret put`. The web's production `VITE_API_URL` is in `apps/web/.env.production` (gitignored).
- `api`'s `build` is `wrangler deploy --dry-run --outdir dist`: it bundles the Worker without deploying.
- `compatibility_date` in `wrangler.toml` can't be later than the installed workerd supports (2026-10-23 for wrangler 4.156).
- lint-staged 17 needs Node 22.22.1 or newer, which sets the root `engines.node`. Its config lives in `package.json` because lint-staged only loads a `.ts` config when passed `--config`.
- `pnpm install` runs the root `prepare` script (`husky`), which points Git at `.husky/`. CI sets `HUSKY=0` to skip it.
- CI uses Node 25 to match local dev. Bump `node-version` in `.github/actions/setup/action.yml` when local Node changes.
- The Secret scan job runs the gitleaks CLI (version and SHA-256 pinned in `ci.yml`) over the full history, not `gitleaks/gitleaks-action`: the action scans `<first pushed commit>^..<head>`, which fails when a push includes the repo's first commit.
- drizzle-kit writes migrations to `supabase/migrations` with `migrations.prefix: 'supabase'`, so file names match the Supabase CLI's `<timestamp>_name.sql`. Drizzle's snapshots sit in `migrations/meta/`, which the CLI skips. Don't hand-edit pushed migrations; don't use `drizzle-kit push`.
- The Supabase CLI is the root devDependency `supabase` (run it as `pnpm exec supabase`). `supabase link` stores the project ref in `supabase/.temp/`, which is gitignored, so each machine links once.
- Every table calls `.enableRLS()` and has no policies, so the publishable key can't read or write anything. The API connects as `postgres`, the table owner, which skips RLS. Add `.enableRLS()` to every new table.
- `profiles.id` references `auth.users(id)` through `authUsers` from `drizzle-orm/supabase`. Don't export `authUsers` from the schema, or drizzle-kit will try to create it.
- Route tests run on PGlite (in-memory Postgres): `app.test.ts` mocks `config/db` so `createDb` returns the test database, which `setUpDatabase()` builds from the real migrations plus a stub `auth.users`. `serveTestJwks()` stubs `fetch` so `jose` gets a test key, and `signedIn(role)` returns headers for a user with that role. Don't import `app` in `test-helpers.ts`: the `config/db` mock imports that file.
- `web` type-checks the API's source through `AppType` (`import type { AppType } from 'api/src/app'`) without Worker globals, so files that `app.ts` reaches import Worker types from `@cloudflare/workers-types` (as `env.ts` does for `Hyperdrive` and `R2Bucket`) instead of using the globals.
- `ADMIN_EMAILS` applies only when a profile is first created, and only if Google marks the email verified. After that only an admin can change a role. Sign out uses `scope: 'local'`, so a facilitator stays signed in on their other devices.
- Call `createDb(c.env)` once per request: a Worker can't reuse a connection across requests, and Hyperdrive does the pooling. postgres.js needs `nodejs_compat` in `wrangler.toml`.
- `db:push` and `db:status` need `supabase link` (which needs `supabase login`). Without a link, pass the URL: `pnpm exec supabase db push --db-url "$DATABASE_URL"` with `packages/db/.env` loaded.
- `DATABASE_URL` uses the session pooler (port 5432). The transaction pooler (6543) doesn't support prepared statements.
- `pnpm audit` reports one moderate advisory (`minimatch`, pulled in by ESLint, dev only). CI fails only on high or critical ones.
