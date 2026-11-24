# Security policy

DigiBridge holds student data: names, student numbers, birth dates and assessment answers. Please report security problems privately, never in a public issue.

## Reporting a vulnerability

Use GitHub's private reporting: open the repository's **Security** tab and choose **Report a vulnerability**. Include:

- what the problem is and where (a route like `POST /api/v1/links/{code}/respondents`, a page, or a file)
- steps to reproduce it
- what an attacker could do with it

You'll get a reply within a week. Please give us time to fix it before you share it anywhere.

## Scope

In scope: the code in this repository, and the deployed app at https://digibridge-web.pages.dev and its API.

Out of scope:

- denial of service or load testing against the deployed app
- reports that need a stolen Google account or physical access to a student's device
- missing headers or settings on third-party services (Supabase, Cloudflare, Google)

Test against your own local copy (see [Getting started](README.md#getting-started)), not against real student data.

## Supported versions

Only the latest commit on `main` is supported.
