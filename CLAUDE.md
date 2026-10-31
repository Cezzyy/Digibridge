# CLAUDE.md

Guide for Claude Code in this repo. Read the docs below before changing anything.

## Project

DigiBridge is a web app that measures the digital literacy of ACLC College of Mandaue students in 3 DigComp 2.2 areas, shows each student their level and matching lessons, and gives the research team a dashboard of who is falling behind. Cez is the sole developer; Morales does QA.

- [docs/PRD.md](docs/PRD.md): what to build. Requirement IDs (AUTH-01, ASM-03, ...) are used by tests, commits and bug reports.
- [docs/TRD.md](docs/TRD.md): how to build it: architecture, data model, API, assessment engine, security.
- [docs/Build plan.md](<docs/Build plan.md>): order of work and stage checklists.

## Status

Stage 0 scaffold. Workspaces, TypeScript, ESLint and Prettier are set up. Most folders hold a placeholder `index.ts`; there is no app code yet.

## Commands

```sh
pnpm install
pnpm dev | build | lint | typecheck | test   # Turborepo, every package
pnpm check                                    # lint + typecheck + test + build (ship check)
pnpm format | format:check                    # Prettier
pnpm --filter <name> <script>                 # one package: web, api, @digibridge/db, @digibridge/shared, @digibridge/config
```

## Layout

| Path              | What                                                                      |
| ----------------- | ------------------------------------------------------------------------- |
| `apps/web`        | Vue 3 SPA, deployed to Cloudflare Pages                                   |
| `apps/api`        | Hono + OpenAPI on Cloudflare Workers; the only code that touches Postgres |
| `packages/db`     | Drizzle schema, migrations and seeds                                      |
| `packages/shared` | Zod enums, option lists and scoring constants used by web and api         |
| `packages/config` | Shared ESLint rules (`eslint/`), used by the root `eslint.config.ts`      |

At the root: `tsconfig.base.json` (shared TypeScript settings; every package's `tsconfig.json` extends it with `../../tsconfig.base.json`), `eslint.config.ts` (one lint config for the repo, rules from `packages/config`), `.prettierrc`, `turbo.json`, and `pnpm-workspace.yaml` (workspaces and the version catalog).

## Rules

- TypeScript everywhere, including config files (`eslint.config.ts`, `vite.config.ts`, `drizzle.config.ts`). No `.js` or `.mjs` files.
- Build each feature in the Build plan's order: schema, shared types, route contract, handler, bind in `app.ts`, tests, web composable, page, ship check.
- Work in small steps and check with the user before starting the next stage.
- The browser talks to Supabase only to sign in. Everything else goes through the API, which checks the role on every route.
- Scoring numbers, enums and option lists live in `packages/shared`. Don't hard-code them anywhere else.
- `apps/web` imports only types from `apps/api` (`import type`), never runtime code.
- Internal packages are used as TypeScript source (`exports` point at `src/*.ts`), with no build step.
- A dependency used by more than one package gets its version in the `catalog:` in `pnpm-workspace.yaml`.
- Secrets never go in the repo, only `.env.example` and `.dev.vars.example`.
- User-facing text is plain English, written for students.

## Versions and gotchas

- TypeScript is pinned to `~6.0`, because typescript-eslint supports only below 6.1. TS 6 defaults `types` to `[]`, so list the types each tsconfig needs. `baseUrl` is deprecated; use `paths` on its own.
- Use Vitest 4.1, not 5: Vitest 5 doesn't support Node 25.
- Use `postgres` (postgres.js) 3.4.x. 4.0 was only days old on 2026-10-31.
- pnpm 12 holds back versions published in the last day (`minimumReleaseAge`). Approve packages that need install scripts with `pnpm approve-builds`.
- ESLint loads `eslint.config.ts` through `jiti`, a root devDependency.
