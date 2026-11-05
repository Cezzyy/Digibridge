# DigiBridge

DigiBridge measures the digital literacy of ACLC College of Mandaue students in three DigComp 2.2 areas: Information and data literacy, Communication and collaboration, and Online safety. Students take a 30-item, 25-minute assessment online or on a kiosk device, then see their level and lessons right away. The research team gets a dashboard broken down by course, year level, age, sex, devices and internet access.

It is the working prototype for the study _DigiBridge: Digital Literacy Assessment Framework and Digital Inclusion_ by Group 2.

## Docs

| Doc                                | What's in it                                               |
| ---------------------------------- | ---------------------------------------------------------- |
| [PRD](docs/PRD.md)                 | What the app does, requirement IDs, scoring rules, screens |
| [TRD](docs/TRD.md)                 | Architecture, data model, API, security, deployment        |
| [Build plan](<docs/Build plan.md>) | Order of work and what "done" means for each stage         |

## Stack

| Part     | Tools                                                                |
| -------- | -------------------------------------------------------------------- |
| Web      | Vue 3, Vite, Vue Router, Pinia, Tailwind CSS v4, on Cloudflare Pages |
| API      | Hono with Zod and OpenAPI, on Cloudflare Workers                     |
| Data     | Supabase Postgres, Auth (Google) and Storage, through Drizzle ORM    |
| Monorepo | Turborepo, pnpm workspaces, TypeScript, ESLint, Prettier             |
| Checks   | GitHub Actions CI, Husky pre-commit hook with lint-staged            |

## Repo layout

```
apps/
  web/        Vue app for respondents, kiosk devices and admins
  api/        API Worker: auth, roles, scoring, dashboard data
packages/
  db/         Database schema and seeds
  shared/     Enums, option lists and scoring constants used by web and api
  config/     Shared ESLint rules
supabase/     Supabase CLI config and SQL migrations
docs/         PRD, TRD and build plan
tsconfig.base.json   Shared TypeScript settings every package extends
eslint.config.ts     One lint config for the whole repo
.github/             CI workflow and its shared setup step
.husky/              Git hooks (pre-commit)
```

## Getting started

You need Node.js 22.22.1 or newer and pnpm 12.

```sh
pnpm install
pnpm dev
```

`pnpm dev` starts the web app at http://localhost:5173 and the API at http://localhost:8787 (API docs at http://localhost:8787/api/reference).

`pnpm check` runs lint, typecheck, tests and build across every package. It must pass before anything is merged into `main`.

`pnpm install` also turns on a pre-commit hook. Before each commit it runs ESLint (with fixes) and Prettier on the files you staged, and stops the commit if ESLint finds an error it can't fix.

On every push to `main` and every pull request, GitHub Actions runs format, lint, typecheck, test and build as separate checks. It also audits dependencies for known security issues, scans the commit history for leaked secrets (API keys, tokens) and lints the workflow files.

## Scripts

Run these from the repo root.

| Command             | What it does                            |
| ------------------- | --------------------------------------- |
| `pnpm dev`          | Start the web app and API locally       |
| `pnpm build`        | Build every app                         |
| `pnpm lint`         | Lint every package with ESLint          |
| `pnpm typecheck`    | Type-check every package                |
| `pnpm test`         | Run the tests                           |
| `pnpm check`        | All four above; run it before merging   |
| `pnpm format`       | Format every file with Prettier         |
| `pnpm format:check` | Check formatting without changing files |

To run a script in one package: `pnpm --filter web dev`, `pnpm --filter api test`, and so on.

## Status

Stage 0 of the build plan: the monorepo is set up with TypeScript, ESLint and Prettier. The web app shows a placeholder page and the API has one route, `/api/v1/health`, with docs at `/api/reference`. App code, environment variables and deploy steps are added as each stage lands.

## Reporting bugs

Open a GitHub Issue with the requirement ID from the PRD, the steps, the expected and actual result, and a screenshot.
