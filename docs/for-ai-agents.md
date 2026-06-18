# For AI Agents

This document is the shortest operational entry point for AI coding agents and automated maintainers working on `@garvae/mcp-mcphub`.

## What This Project Is

- A typed MCP server for managing MCPHub itself
- Not a raw passthrough for downstream `/mcp`
- CLI-first and transport-first, with programmatic exports treated as advanced usage

## Canonical Sources

- Tool registry: `src/mcp/registry.ts`
- Route coverage matrix: `src/core/coverage/matrix.ts`
- Generated tool catalogs: `docs/generated/*`
- Generated route coverage exports: `docs/api-coverage.md` and `docs/generated/api-coverage.json`
- Runtime config schema: `src/config/schema.ts`
- Environment examples: `.env.example`

## Safety Model

- Start analysis from the smallest possible exposure profile.
- Assume dangerous feature flags are disabled unless you explicitly set them.
- Do not treat `tools.md` as the exact runtime schema source. Use generated catalogs or the runtime `tools/list` response.
- Destructive tools require confirmation fields.
- Secrets must stay redacted in docs, examples, tests, and fixtures.

## Important Feature Flags

- `ALLOW_AUTH_ADMIN_TOOLS`
- `ALLOW_STDIO_SERVER_CREATE`
- `ALLOW_MCPB_UPLOAD`
- `ALLOW_SYSTEM_CONFIG_WRITE`
- `MCP_FORCE_READONLY`

## Tool Surfaces

- Read-only and low-risk operations are available in `safe`.
- Reversible changes are available in `ops`.
- CRUD and higher-trust management surfaces are available in `admin`.
- The highest-risk import, upload, and system-config operations are available in `all`.

Representative catalogs:

- [generated/tools.safe.md](./generated/tools.safe.md)
- [generated/tools.ops.md](./generated/tools.ops.md)
- [generated/tools.admin.md](./generated/tools.admin.md)
- [generated/tools.all.md](./generated/tools.all.md)

## Regeneration Rules

If you touch registry metadata or route coverage:

```bash
pnpm docs:coverage
pnpm docs:tools
```

Before finalizing changes:

```bash
pnpm docs:coverage:check
pnpm docs:tools:check
pnpm test:coverage-matrix
```

## What Agents Should Not Do

- Do not add a generic arbitrary HTTP proxy tool.
- Do not silently expose dangerous surfaces in lower profiles.
- Do not claim official MCPHub affiliation.
- Do not hand-edit generated docs in `docs/generated/`.
- Do not weaken redaction, confirmations, or SSRF/allowlist checks without updating security docs and tests.
