# Release Process

This document covers the public package release path for `@garvae/mcp-mcphub`.

## Release Model

This repository uses Changesets for versioning and GitHub Actions for release orchestration.

Normal flow:

1. feature or fix PRs that change published behavior include a changeset
2. the PR merges into `main` after required checks pass
3. `release.yml` runs on `main`, validates the release path, and asks `changesets/action` to create or update the Version Packages PR when pending changesets exist
4. the Version Packages PR lands on `main` after review
5. `release.yml` runs again and publishes the new version to npm through GitHub Actions OIDC

Manual `workflow_dispatch` is kept as a maintenance fallback for the same release pipeline.

## Pre-release Checklist

Before publishing, verify:

- README links and quick-start commands still match the package
- generated docs are current
- coverage drift checks pass
- package tarball contains the documented runtime files
- changelog and release notes reflect any breaking behavior

## Required Commands

Run:

```bash
pnpm install --frozen-lockfile
pnpm docs:compatibility
pnpm docs:coverage
pnpm docs:tools
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm test:integration
pnpm test:coverage
pnpm test:coverage-matrix
pnpm test:package:installed
pnpm publish:dry-run
```

## Release-facing Generated Artifacts

These files must stay in sync with code:

- `docs/compatibility.md`
- `docs/api-coverage.md`
- `docs/generated/api-coverage.json`
- `docs/generated/tools.*.md`
- `docs/generated/tools.*.json`

## npm Packaging

The tarball should contain:

- `dist/`
- `docs/`
- `.env.example`
- `AGENTS.md`
- `docker-compose.example.yml`
- `README.md`
- `LICENSE`
- `CHANGELOG.md`

The tarball must not contain:

- `src/`
- `tests/`
- `.github/`
- secrets or local `.env` files

Use:

```bash
pnpm pack:validate
npm pack --dry-run
```

`AGENTS.md` stays in the tarball intentionally as public AI-agent guidance for package users and maintainers working from the installed artifact.

## GitHub and npm Settings to Review

These checks are partly outside the repository tree and should be reviewed before a public release:

- repository description and topics
- GitHub Sponsors enabled for `garvae`
- `.github/FUNDING.yml` matches active funding handles only
- Ko-fi profile is `https://ko-fi.com/garvae`; verify it stays active before changing funding links
- README support section links only to active funding profiles
- Discussions enabled and linked from `README.md`, `SUPPORT.md`, and issue contact routing
- issue labels and templates
- recommended labels created or planned: `good first issue`, `help wanted`, `documentation`, `compatibility`, `upstream-drift`, `client-config`, `security`, `tool-catalog`, `testing`, `transport`, `stdio`, `streamable-http`, `release`, `question`, `needs-repro`
- branch protection and required checks
- secret scanning, push protection, and dependency alerts
- npm package ownership under `@garvae`
- trusted-publishing configuration for `release.yml`
- repository social preview uses `assets/social-preview.png`
- Private Vulnerability Reporting is enabled and `SECURITY.md` points to the active path
- Discussions categories still match current support routing

## Release Workflow Expectations

`release.yml` should remain aligned with npm Trusted Publishing requirements:

- GitHub-hosted runners
- `id-token: write`
- Node `24` for the release job
- full release-grade validation before `changesets/action`
- no long-lived `NPM_TOKEN` dependency for the normal publish path once Trusted Publishing is attached

If npm Trusted Publishing must be repaired, fix the package's trusted publisher entry for:

- owner or user: `garvae`
- repository: `mcp-mcphub`
- workflow filename: `release.yml`
- allowed action: `npm publish`

Current temporary fallback:

- the release workflow reads repository secret `NPM_TOKEN` for publish authentication until npm Trusted Publishing can be attached
- track removal of that fallback in issue `#17`

## Rollback Expectations

Before any release:

- verify the previous published version can still be installed
- keep the previous tag and tarball available
- document the exact behavior change in `CHANGELOG.md`

## Manual Review

Before final release approval, inspect:

- rendered GitHub README
- rendered npm README during dry-run review and after publish
- GitHub Sponsors link resolves and the Sponsor button appears
- GitHub Social Preview configuration
- generated tool catalogs
- release workflow behavior on `main`
