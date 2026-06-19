# Release Process

This document covers the public package release path for `@garvae/mcp-mcphub`.

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
```

## GitHub and npm Settings to Review

These checks are partly outside the repository tree and should be reviewed before a public release:

- repository description and topics
- GitHub Sponsors enabled for `garvae`
- `.github/FUNDING.yml` matches active funding handles only
- Ko-fi profile is `https://ko-fi.com/garvae`; verify it stays active before changing funding links
- README support section links only to active funding profiles
- Discussions enabled or intentionally deferred
- issue labels and templates
- recommended labels created or planned: `good first issue`, `help wanted`, `documentation`, `compatibility`, `upstream-drift`, `client-config`, `security`, `tool-catalog`, `testing`, `transport`, `stdio`, `streamable-http`, `release`, `question`, `needs-repro`
- branch protection and required checks
- secret scanning and dependency alerts
- npm package ownership under `@garvae`
- publish credentials or trusted-publishing configuration
- after the repository becomes public, upload `assets/social-preview.png` in GitHub repository Settings -> Social preview
- after the repository becomes public, enable GitHub Security Advisories / Private Vulnerability Reporting
- after the repository becomes public, revisit `SECURITY.md` wording if the private reporting path changed
- after the repository becomes public, consider Discussions categories such as Announcements, Q&A, Ideas, Client setup, Show and tell, and Compatibility reports

## Publishing Model

Current workflow support in-repo is compatible with provenance-enabled npm publishing.

Preferred long-term model:

- GitHub Actions with OIDC trusted publishing

Fallback model:

- `NPM_TOKEN` stored only as a GitHub Actions secret

If trusted publishing is not configured yet, document that gap in the release notes instead of pretending it is already active.

## Trusted Publishing Constraint

npm trusted publishing is configured from the package settings page on npmjs.com.

That means the package must already exist in the npm registry before the trust relationship can be attached.

For `@garvae/mcp-mcphub`, the practical sequence is:

1. complete first package publication intentionally
2. open npm package settings
3. attach the GitHub Actions workflow as the trusted publisher
4. switch package publishing access to disallow traditional tokens if desired

## Current Safe Default

The repository release workflow is intentionally dry-run-first.

- release automation runs only through `workflow_dispatch`
- real npm publish is disabled unless both conditions are true:
  - the workflow is started with `workflow_dispatch`
  - `publish=true`
  - repository variable `ENABLE_NPM_PUBLISH=1` is set

This prevents accidental first publication before npm ownership and trusted-publishing setup are complete.

The workflow no longer requires `NPM_TOKEN` for the preferred release path. Real publishing is expected to use npm trusted publishing via OIDC once the package exists and the trust relationship has been added on npmjs.com.

## Rollback Expectations

Before any first public release or breaking release:

- verify the previous published version can still be installed
- keep the previous tag and tarball available
- document the exact behavior change in `CHANGELOG.md`

## Manual Review

Before final release approval, inspect:

- rendered GitHub README
- rendered npm README during dry-run review
- GitHub Sponsors link resolves and the Sponsor button appears once the repository is public
- GitHub Social Preview configuration after the repository becomes public
- generated tool catalogs
- release workflow inputs and secrets usage
