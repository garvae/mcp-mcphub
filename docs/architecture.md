# Architecture

## Overview

`@garvae/mcp-mcphub` is organized around one shared MCPHub REST client and one shared tool registry, with transport-specific entrypoints layered on top.

```text
MCP client
  -> stdio or Streamable HTTP transport
    -> managed MCP server
      -> tool registry
        -> typed MCPHub REST client
          -> upstream MCPHub management endpoints
```

## Runtime Layers

### `src/core`

- shared REST client families;
- coverage matrix and verification helpers;
- schema definitions for request and response payloads;
- redaction and risk metadata.

### `src/mcp`

- stable `mcphub_*` tool names;
- profile filtering;
- tool annotations;
- structured tool outputs.

### `src/transports/http`

- `/mcp/safe`, `/mcp/ops`, `/mcp/admin`, `/mcp/all`;
- static bearer-token authentication;
- host and origin checks;
- body-size limit and in-memory rate limit;
- `/healthz` probe.

### `src/transports/stdio`

- one local process per MCP client;
- stdout reserved for MCP JSON-RPC;
- stderr reserved for logs and diagnostics;
- support for `--config`, `--profile`, and `--exposure`.

### `src/config`

- environment schema parsing;
- single-profile and multi-profile MCPHub target support;
- HTTP exposure defaults and feature flags.

### `src/security`

- literal private-host and localhost blocking for mutation payload URLs;
- stdio command allowlist gating;
- description linting for obvious secret leakage patterns.

### `src/observability`

- structured JSON logs;
- audit-event wrapper for transport-level actions.

## Source of Truth Strategy

This project is route-first.

- Upstream MCPHub routes are snapshotted from `samanhappy/mcphub`.
- `src/core/coverage/matrix.ts` is the canonical classification layer.
- `docs/api-coverage.md` is generated from that matrix.
- Tool registration reads from the coverage metadata so profile/risk drift is visible in tests.

We intentionally do not use MCPHub's public `/api/openapi.json` as the source of truth for the management API because upstream uses that document to describe downstream tool execution, not the management surface.

## Key Design Choices

- The MCP layer is not a raw HTTP proxy.
- Profiles are enforced server-side, not documented as a convention only.
- Redaction happens before tool data is returned to clients.
- Feature flags gate especially dangerous administrative operations.
- Both transports share the same tool registry and client implementation.

## Assumptions

- Verified upstream baseline is `v1.0.15`.
- Versions earlier than `v1.0.15` are best-effort only.
- Activity endpoints may be unavailable on file-mode MCPHub instances.
- Cloud and registry endpoints depend on upstream availability and may fail cleanly even when local configuration is correct.

## Known Gaps

- The stateless `2026-07-28` HTTP path currently returns direct JSON responses only; it does not yet expose request-scoped SSE streams or `subscriptions/listen`.
- SSRF protection does not currently resolve arbitrary public hostnames before allowing them.
- The self-protection helper for "do not mutate the management server itself" exists in code but is not yet wired into all mutation paths.

## ADR Index

- [0001 Route-first coverage](./adrs/0001-route-first-coverage.md)
- [0002 Profile filtering](./adrs/0002-profile-filtering.md)
- [0003 Shared client and redaction](./adrs/0003-shared-client-and-redaction.md)
- [0004 Dual transport runtime](./adrs/0004-dual-transport-runtime.md)
- [0005 Security guardrails](./adrs/0005-security-guardrails.md)
