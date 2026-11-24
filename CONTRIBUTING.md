# Contributing

Thanks for taking a look. DigiBridge started as a college research project, so it's maintained by one developer and changes are reviewed as time allows. Bug reports and small fixes are the most welcome.

## Before you start

- **Bugs:** open an issue with the bug report form. If it's a security problem, follow [SECURITY.md](SECURITY.md) instead.
- **New features:** open an issue first to talk about it, so you don't spend time on something that won't be merged.
- Read [docs/PRD.md](docs/PRD.md) (what the app does) and [docs/TRD.md](docs/TRD.md) (how it's built). Requirement IDs like `ASM-03` come from the PRD.

## Setting up

Follow [Getting started](README.md#getting-started) in the README. You'll need your own Supabase project and Cloudflare account; nothing in this repo connects to the real ones.

## Making a change

1. Branch off `develop` with a name like `feat/<short-name>` or `fix/<short-name>`.
2. Build features in the order in [Building a feature](README.md#building-a-feature): schema, shared types, route contract, handler, tests, then the web side.
3. Keep to the rules in [CLAUDE.md](CLAUDE.md#rules). The main ones:
   - TypeScript everywhere, no `.js` or `.mjs` files.
   - Scoring numbers, enums and option lists live in `packages/shared` only.
   - The browser talks to Supabase only to sign in; everything else goes through the API.
   - Text students see is plain English.
4. Add tests: route tests in `apps/api/src/test/`, unit tests next to the code in `lib/`.
5. Run `pnpm check` (lint, typecheck, test and build) before you push.
6. Use [Conventional Commits](https://www.conventionalcommits.org) for commit titles, like `fix(api): reject a choice from another question`.
7. Open the pull request against `develop` and fill in the template.

## License

By contributing, you agree that your work is released under the [MIT License](LICENSE).
