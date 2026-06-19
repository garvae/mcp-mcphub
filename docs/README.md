# Documentation Index

This directory stores durable product documentation for `@garvae/mcp-mcphub`.

## Start Here

- [getting-started.md](./getting-started.md): first-run guide with `npx`, `stdio`, local HTTP, and verification.
- [minimal-config.md](./minimal-config.md): shortest working environment sets.
- [configuration.md](./configuration.md): complete environment and JSON profile reference.
- [runtime-modes.md](./runtime-modes.md): when to use `stdio`, local HTTP, shared HTTP, or Docker.

## Public Release and Upstream Context

- [upstream-mcphub.md](./upstream-mcphub.md): official MCPHub links, compatibility baseline, and project relationship.
- [compatibility.md](./compatibility.md): generated compatibility notes and tested targets.
- [release-process.md](./release-process.md): release checklist, tarball checks, and GitHub/npm settings to review.
- [../ROADMAP.md](../ROADMAP.md): current public direction for compatibility, docs, safety, and coverage work.

## Security and Operations

- [security.md](./security.md): threat model, feature flags, redaction, audit logging, and current limitations.
- [testing.md](./testing.md): local, compatibility, live, package, coverage, and release-workflow test guidance.
- [deployment.md](./deployment.md): npm, Docker, Compose, CI, and rollback guidance.
- [streamable-http.md](./streamable-http.md): HTTP transport endpoints, auth, CORS, and reverse-proxy guidance.
- [stdio.md](./stdio.md): stdio usage patterns and local client examples.
- [troubleshooting.md](./troubleshooting.md): common startup and connectivity failures.

## Tooling and Coverage

- [tools.md](./tools.md): curated tool overview by product area.
- [generated/README.md](./generated/README.md): generated per-profile tool catalogs and JSON exports.
- [api-coverage.md](./api-coverage.md): generated route-by-route management API coverage matrix.
- [tool-examples.md](./tool-examples.md): representative calls by profile.
- [for-ai-agents.md](./for-ai-agents.md): operational entry point for AI coding agents.

## Architecture and Integration

- [architecture.md](./architecture.md): runtime layers, shared abstractions, and ADR links.
- [auth-modes.md](./auth-modes.md): static bearer, OAuth introspection, Better Auth bridge, and upstream auth modes.
- [caddy.md](./caddy.md): production Caddy reverse-proxy configuration.
- [managed-gateway-integration.md](./managed-gateway-integration.md): generic launcher, shared-gateway, and Streamable HTTP integration patterns.

## ADRs

- [adrs/0001-route-first-coverage.md](./adrs/0001-route-first-coverage.md)
- [adrs/0002-profile-filtering.md](./adrs/0002-profile-filtering.md)
- [adrs/0003-shared-client-and-redaction.md](./adrs/0003-shared-client-and-redaction.md)
- [adrs/0004-dual-transport-runtime.md](./adrs/0004-dual-transport-runtime.md)
- [adrs/0005-security-guardrails.md](./adrs/0005-security-guardrails.md)

## Documentation Rules

- Documentation in this directory is written in English.
- Examples must use placeholders, never real credentials.
- `api-coverage.md` and `docs/generated/*` are generated artifacts and should not be edited manually.
- Tool, coverage, configuration, and security changes should update the matching document in the same branch.
- Run `pnpm docs:compatibility`, `pnpm docs:coverage`, and `pnpm docs:tools` when touching generated documentation sources.
