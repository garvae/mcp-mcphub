# Contributing

Thanks for contributing to `@garvae/mcp-mcphub`.

This project stays useful only if it keeps pace with real MCPHub deployments, real MCP clients, and real upstream API changes. Small, concrete improvements are welcome.

## Project Scope

This repository focuses on MCPHub management APIs exposed as typed MCP tools.

Please avoid contributions that turn the project into:

- a raw arbitrary HTTP proxy
- a generic downstream `/mcp` passthrough
- an unofficial rewrite of MCPHub's UI or CLI

## What Contributions Are Welcome

- bug fixes with reproducible tests
- client setup examples for real MCP clients
- documentation clarifications and troubleshooting notes
- compatibility reports for new MCPHub versions
- responsible security research and hardening PRs, with private disclosure for sensitive findings
- route coverage updates when upstream MCPHub changes
- tool description, schema, or risk-note improvements
- transport, packaging, and diagnostics improvements
- tests for auth boundaries, redaction, SSRF validation, dangerous feature flags, and transport behavior

## Good First Contributions

- improve docs for the client you actually use
- add a troubleshooting note for a failure mode you hit
- improve placeholders or copy-paste examples
- add tests for a small tool family
- report or fix upstream compatibility drift
- improve generated tool descriptions or coverage notes

## Areas Requiring Extra Care

- auth, bearer keys, OAuth clients, and system config
- secret redaction and logging behavior
- exposure-profile filtering
- stdio server creation, upload, and template import flows
- generated docs and route coverage classifications

If your change touches risk classification, confirmations, feature flags, or transport auth, update docs and tests in the same branch.

## Local Setup

Use Node.js `22.13+`. Node 22 LTS is the baseline; Node 24 is also supported.

```bash
pnpm install
pnpm build
pnpm test
```

## Testing Matrix

Run the smallest relevant checks for your change first.

Common baseline:

```bash
pnpm test
pnpm test:integration
pnpm test:coverage-matrix
pnpm build
```

When docs or generated outputs change:

```bash
pnpm docs:compatibility
pnpm docs:coverage
pnpm docs:tools
pnpm typecheck
pnpm lint
pnpm format:check
```

When npm-facing packaging changes:

```bash
pnpm test:package:installed
pnpm pack:validate
```

See [docs/testing.md](./docs/testing.md) for the full matrix.

## Generated Docs Rules

Do not hand-edit generated files in:

- `docs/generated/*`
- `docs/api-coverage.md`
- `docs/compatibility.md`

Regenerate them with:

```bash
pnpm docs:compatibility
pnpm docs:coverage
pnpm docs:tools
```

If a PR changes the registry, tool exposure, or route classifications, generated docs should change too.

## Security Expectations

- keep dangerous feature flags disabled by default
- preserve structured confirmations for destructive tools
- keep secrets out of examples, fixtures, logs, screenshots, and commits
- do not claim official MCPHub affiliation
- do not add private maintainer-specific integration details
- update [docs/security.md](./docs/security.md) if you change redaction, audit logging, auth, or SSRF guard behavior

## How to Propose a New Route or Tool

Open a feature request or PR with:

- the upstream MCPHub route or product area
- the user workflow it unlocks
- the lowest exposure profile that should expose it
- the expected risk class
- any confirmation or redaction needs
- whether generated catalogs or coverage docs should change

The bar is not "can the REST API do it?" The bar is "can this be exposed as a stable MCP capability with a clear safety model?"

## How to Report Upstream Compatibility Drift

Use the upstream compatibility template when:

- a documented MCPHub route changed behavior
- a schema changed in a way that breaks this package
- route coverage or generated catalogs no longer reflect upstream reality

Include the MCPHub version or image tag, the affected route or area, reproduction steps, and links to upstream docs or release notes when available.

## Pull Request Checklist

Before opening a PR, make sure:

- the change is scoped and explained
- affected profiles and transports are called out
- tests run are listed honestly
- generated docs are updated if required
- security/config docs are updated if behavior changed
- no real tokens, cookies, private URLs, or production logs are included

Use [SUPPORT.md](./SUPPORT.md) for support routing and [ROADMAP.md](./ROADMAP.md) for current public direction.
