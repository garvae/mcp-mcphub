# Runtime Modes

This project is intentionally local-first.

It should feel lightweight when used as a workstation MCP server, but it also supports heavier shared-service deployment patterns when needed.

## The Short Version

- `stdio` is the default local mode.
- local HTTP is the default network mode.
- Docker is optional runtime packaging, not a product requirement.

## Mode Summary

| Mode           | Best for                                               | Docker required      | Network listener |
| -------------- | ------------------------------------------------------ | -------------------- | ---------------- |
| `stdio`        | local MCP clients launched as child processes          | no                   | no               |
| local HTTP     | local testing or local multi-client use                | no                   | yes              |
| shared HTTP    | shared internal service, CI, reverse proxy, automation | no, but often useful | yes              |
| Dockerized HTTP| reproducible deployment and ops workflows              | yes, by choice       | yes              |

## `stdio`

Use `stdio` when:

- one client launches the MCP server directly;
- you do not need a shared HTTP endpoint;
- you want the smallest possible runtime surface;
- you prefer credentials to stay in the client-side environment.

Benefits:

- no exposed TCP port;
- simple `npx` startup;
- profile selection per launched process;
- good fit for Codex, Claude Desktop, and similar local tools.

Tradeoffs:

- each client starts its own process;
- no shared service endpoint;
- less convenient for multi-client or remote access.

## Local HTTP

Use local HTTP when:

- you want to inspect behavior with `curl` or browser tools;
- multiple local consumers need one MCP endpoint;
- you want to test auth tokens, reverse-proxy headers, or HTTP-era compatibility.

Benefits:

- explicit health endpoint;
- one server process for multiple local consumers;
- easier transport debugging;
- works without containerization.

Tradeoffs:

- you now manage a local listening port;
- you must configure inbound auth tokens or another HTTP auth mode.

## Shared HTTP

Use shared HTTP when:

- you want a central MCP service for a team, agent host, or CI environment;
- you need stable URLs such as `/mcp/safe` or `/mcp/admin`;
- you want token-to-profile mapping at the service boundary;
- you need reverse-proxy integration and centralized monitoring.

Benefits:

- one service can front one or many upstream MCPHub instances;
- access profiles are enforced server-side;
- better fit for automation infrastructure;
- simpler to observe and operate than many ad hoc local processes.

Tradeoffs:

- more operational responsibility;
- inbound auth, origin rules, and host validation matter much more;
- mistakes affect more than one client.

## Why Docker Exists in This Repository

Docker is here for operational reasons, not because the project fundamentally depends on containers.

It helps with:

- reproducible deployment;
- shipping a prebuilt runtime without requiring a local Node toolchain;
- running the HTTP server in Compose or container-based platforms;
- CI workflows that validate container packaging;
- compatibility tests against real upstream MCPHub images.

Docker is especially useful for:

- teams already running reverse proxies and containers;
- CI jobs that must boot the server predictably;
- compatibility matrix testing with multiple upstream MCPHub versions.

Docker is not required for:

- `npx @garvae/mcp-mcphub stdio --exposure=safe`
- `npx @garvae/mcp-mcphub http`
- local single-user development

## Recommended Mental Model

Treat the project as:

```text
lightweight Node-based MCP server first
optional Docker deployment target second
```

That means:

- documentation should lead with `npx` and `stdio`;
- Docker belongs in deployment and operations sections, not at the top-level onboarding path;
- users should understand the product before they ever need a container.

## Typical User Journeys

### Journey A: Local MCP client

1. Set `MCPHUB_URL` and upstream credentials.
2. Launch `npx @garvae/mcp-mcphub stdio --exposure=safe`.
3. Connect the local client.
4. Expand to `ops` or `admin` only if needed.

### Journey B: Local HTTP testing

1. Set upstream credentials.
2. Set `MCP_HTTP_AUTH_TOKENS_JSON`.
3. Launch `npx @garvae/mcp-mcphub http`.
4. Probe `http://127.0.0.1:7345/healthz`.
5. Connect a client to `/mcp/safe`.

### Journey C: Shared service

1. Decide which profiles must be published.
2. Put the server behind a reverse proxy.
3. Configure explicit HTTP auth mappings.
4. Deploy via `npm`, systemd, Compose, or Docker.
5. Keep dangerous flags disabled unless the use case truly requires them.

## Related Documents

- [getting-started.md](./getting-started.md)
- [stdio.md](./stdio.md)
- [streamable-http.md](./streamable-http.md)
- [deployment.md](./deployment.md)
- [security.md](./security.md)
