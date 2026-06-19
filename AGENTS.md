# Agent Notes

This file is the concise operational guide for coding agents and automation working inside `/mcphub`.

## Purpose

- Build and maintain an MCP server for managing MCPHub instances through the MCPHub REST Management API.
- Keep the project CLI-first and transport-first.
- Preserve the distinction between MCPHub management APIs and downstream `/mcp` gateway behavior.

## Main Sources of Truth

- Tool registry: `src/mcp/registry.ts`
- Route coverage matrix: `src/core/coverage/matrix.ts`
- Runtime config schema: `src/config/schema.ts`
- Generated tool catalogs: `docs/generated/*`
- Generated route coverage docs: `docs/api-coverage.md` and `docs/generated/api-coverage.json`

## Required Validation

Run the smallest relevant set first, then the release-facing checks before finalizing non-trivial work:

```bash
pnpm test
pnpm test:integration
pnpm test:coverage-matrix
pnpm typecheck
pnpm lint
pnpm format:check
pnpm docs:coverage
pnpm docs:tools
pnpm test:package:installed
```

## Security Rules

- Keep dangerous feature-flagged surfaces disabled by default.
- Do not remove redaction, confirmation fields, or SSRF guards without updating tests and docs.
- Do not add a generic arbitrary HTTP proxy tool.
- Do not claim official MCPHub affiliation.
- Do not add private maintainer-specific integration documentation.
- Do not document or publish maintainer-owned Docker images unless explicitly requested.

## Public-Facing Documentation Rules

- Preserve community-friendly wording in public docs.
- Do not add fake badges, fake metrics, or hype claims.
- Do not add private integration details, private domains, or maintainer-only workflows.
- Do not present Discussions as enabled unless the repository actually enables them.
- Update `README.md`, `CONTRIBUTING.md`, and `SUPPORT.md` when public contribution or support workflows change.

## Documentation Rules

- Update security, configuration, or runtime docs when behavior changes.
- Regenerate `docs/generated/*` instead of editing generated files by hand.
- Keep examples in English and use placeholders only.
- Keep docs public-safe: no private domains, private repo names, or maintainer-specific deployment details.

## Changes Requiring Extra Care

- `src/mcp/registry.ts`
- `src/transports/http/*`
- `src/transports/stdio/*`
- `src/security/*`
- `.github/workflows/*`
- `package.json`
