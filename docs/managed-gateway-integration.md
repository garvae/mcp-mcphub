# Managed Gateway Integration

This document explains how to use `@garvae/mcp-mcphub` with a generic MCP manager, launcher, or shared gateway.

The package supports two common integration shapes:

1. local `stdio` execution managed by a client or launcher;
2. a shared Streamable HTTP endpoint managed by your own runtime or reverse proxy.

## When to Use `stdio`

Use `stdio` when:

- one local client starts the process itself;
- you want the smallest possible setup;
- you do not need a reusable network endpoint.

Typical launcher model:

```json
{
  "mcpServers": {
    "mcphub-safe": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@garvae/mcp-mcphub", "stdio", "--exposure=safe"],
      "env": {
        "MCPHUB_URL": "https://mcphub-site.com",
        "MCPHUB_TOKEN": "REPLACE_ME"
      }
    }
  }
}
```

## When to Use Streamable HTTP

Use HTTP when:

- several clients should share one endpoint;
- you want reverse-proxy control, access-token mapping, or infrastructure-managed startup;
- you want profile-specific URLs such as `/mcp/safe` and `/mcp/admin`.

Typical endpoint layout:

- `/mcp/safe`
- `/mcp/ops`
- `/mcp/admin`
- `/mcp/all`

Minimal local HTTP launch:

```bash
export MCPHUB_URL="https://mcphub-site.com"
export MCPHUB_TOKEN="REPLACE_ME"
export MCP_HTTP_AUTH_TOKEN="REPLACE_ME_SAFE_TOKEN"

npx @garvae/mcp-mcphub http
```

## Shared Gateway Pattern

If you operate a shared MCP gateway or runtime, the usual pattern is:

1. run `@garvae/mcp-mcphub` as an HTTP service;
2. keep it behind a reverse proxy or internal network boundary;
3. map inbound tokens to exposure profiles;
4. register the resulting HTTP endpoint in your gateway or manager.

This package does not require any product-specific manager integration. If your manager can connect to a Streamable HTTP MCP endpoint, it can use this package.

## Local `stdio` Versus Shared HTTP

| Goal                                      | Recommended mode |
| ----------------------------------------- | ---------------- |
| One local trusted client                  | `stdio`          |
| Several clients need one managed endpoint | Streamable HTTP  |
| Reverse proxy, shared auth, or CI access  | Streamable HTTP  |
| Quick local development                   | `stdio` first    |

## Inbound HTTP Authentication

HTTP mode uses local auth configured in this package itself.

- `MCP_HTTP_AUTH_TOKEN`: shortest single-token setup
- `MCP_HTTP_AUTH_TOKENS_JSON`: token-to-profile map for several clients or profiles

Example:

```dotenv
MCP_HTTP_AUTH_TOKENS_JSON={"REPLACE_ME_SAFE_TOKEN":"safe","REPLACE_ME_ADMIN_TOKEN":"admin"}
```

These tokens do not come from upstream MCPHub. You create and store them yourself.

## Upstream MCPHub Authentication

This package separately needs an upstream credential for the MCPHub instance it manages:

- `MCPHUB_URL`
- `MCPHUB_TOKEN`

That upstream credential is unrelated to the inbound HTTP token your local clients use.

## Using `mcp-proxy` or Similar Bridges

If a client only supports one transport shape, a generic MCP bridge such as `mcp-proxy` can sit in front of this package:

- `stdio` package -> bridge -> HTTP-only client
- HTTP package -> bridge -> local client

That is an optional deployment choice, not a requirement of this package.

## Recommended Default

For most users:

1. start with `stdio`;
2. move to HTTP only when you actually need a shared endpoint;
3. keep HTTP private and explicitly authenticated;
4. expose only the smallest profile that fits the workflow.
