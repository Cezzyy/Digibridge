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

## Branches

- `main` is the released code. It's protected: changes reach it only through a pull request from `develop` that passes CI.
- `develop` is where finished work collects. Pull requests go here.
- `feat/<name>` and `fix/<name>` branches come off `develop`.

## Versions and releases

DigiBridge uses [Semantic Versioning](https://semver.org). The version is in the root [package.json](package.json), and each release is a `vX.Y.Z` tag on `main` with a GitHub Release.

| Bump  | When                                                                                        | Example        |
| ----- | ------------------------------------------------------------------------------------------- | -------------- |
| Major | A change that breaks `/api/v1`, or a database change that needs existing data fixed by hand | 1.4.2 to 2.0.0 |
| Minor | A new feature that keeps everything else working                                            | 1.4.2 to 1.5.0 |
| Patch | Bug fixes only                                                                              | 1.4.2 to 1.4.3 |

To release:

1. On `develop`, move the notes under `[Unreleased]` in [CHANGELOG.md](CHANGELOG.md) into a new version heading with today's date, and set the same version in the root `package.json`. Commit as `chore(release): vX.Y.Z`.
2. Open a pull request from `develop` to `main` (`gh pr create --base main --head develop --title "Release vX.Y.Z"`), wait for CI, and merge it with **Create a merge commit**. `main` is protected, so this is the only way in.
3. Tag the merge on `main` and push the tag: `git checkout main && git pull && git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`.
4. Create the GitHub Release from the tag with that version's changelog notes: `gh release create vX.Y.Z --notes-file <notes>`.

## License

By contributing, you agree that your work is released under the [MIT License](LICENSE).
