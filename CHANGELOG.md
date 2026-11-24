# Changelog

All notable changes to DigiBridge are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) as described in [CONTRIBUTING.md](CONTRIBUTING.md#versions-and-releases).

## [Unreleased]

## [1.0.0] - 2026-11-24

The version used for the pilot and the thesis defense.

### Added

- **Online mode:** Google sign-in, the privacy notice, a general profile and one assessment per account.
- **School links:** students join through `/s/<code>` without signing in, with the school profile (student number, course, year level), one attempt per student number across all links, and a response limit and last day per link.
- **Assessment:** 10 questions per DigComp 2.2 area (4 basic, 4 intermediate, 2 advanced), shuffled questions and choices, a server-timed countdown, answers saved as they're picked, and attempts closed by themselves once time runs out.
- **Results:** overall and per-area levels (Beginner, Basic, Intermediate, Advanced), a radar chart, the matching lessons, and the System Usability Scale survey.
- **Lessons:** a public library of 9 lessons, 3 tiers in each of the 3 areas.
- **Admin dashboard:** overview, respondents with filters, search and a detail drawer, analysis charts, item analysis, school links, voiding attempts and deleting respondents, and CSV and Excel export.
- **Editors:** questions and lessons, with live previews and checks that keep past scores valid.
- **Staff preview:** staff can try the whole student flow without saving anything to the research data.
- **Security:** row-level security on every table, rate limits, strict security headers and hashed respondent tokens.

[Unreleased]: https://github.com/Cezzyy/Digibridge/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Cezzyy/Digibridge/releases/tag/v1.0.0
