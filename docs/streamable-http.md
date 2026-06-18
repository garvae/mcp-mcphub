# Streamable HTTP

Use HTTP mode when you want this project to act as a service instead of a per-client child process.

Common reasons:

- multiple clients need the same MCP endpoint;
- you want `/mcp/safe`, `/mcp/ops`, `/mcp/admin`, or `/mcp/all` URLs;
- you are running the server in CI, Docker, or behind a reverse proxy;
- you need transport-level auth at the MCP boundary.

## Endpoints

The HTTP transport exposes one MCP endpoint per profile:

- `/mcp/safe`
- `/mcp/ops`
- `/mcp/admin`
- `/mcp/all`

It also exposes:

- `/healthz` for process-level health checks

## Start the Server

```bash
export MCPHUB_URL="https://mcphub-site.com"
export MCPHUB_TOKEN="REPLACE_ME"
export MCP_HTTP_AUTH_TOKEN="REPLACE_ME_SAFE_TOKEN"
mcp-mcphub http
```

The single-token shortcut above grants the default `safe` profile.

If you want multiple tokens or different profile bindings, switch to `MCP_HTTP_AUTH_TOKENS_JSON`.

No-install equivalent:

```bash
npx @garvae/mcp-mcphub http
```

Optional overrides:

```bash
mcp-mcphub http --host 127.0.0.1 --port 7345 --profile primary --readonly --config .env
```

`--profile` selects one upstream MCPHub target from `MCPHUB_PROFILES_JSON`.

## Transport Modes

The HTTP runtime supports two protocol eras behind the same `/mcp/<profile>` paths.

### Stateful mode

`MCP_HTTP_MODE=stateful` is the default.

- compatible with the current npm-released MCP TypeScript SDK line;
- uses the legacy `initialize` handshake;
- only HTTP `GET`, `POST`, and `DELETE` are accepted on MCP endpoints;
- supports GET-based SSE behavior for `2025-11-25` era clients.

### Stateless mode

`MCP_HTTP_MODE=stateless` enables the `2026-07-28` transport shape.

- only HTTP `POST` is accepted on MCP endpoints;
- `GET` and `DELETE` probes return `405 Method Not Allowed`;
- request metadata must be mirrored into `MCP-Protocol-Version`, `Mcp-Method`, and, where required, `Mcp-Name` headers;
- `server/discover` is implemented directly by the HTTP adapter;
- responses are emitted as JSON objects without session ids.

## Authentication

Each request must authenticate with either:

- `Authorization: Bearer <token>`
- `x-auth-token: <token>`

With `MCP_HTTP_AUTH_MODE=static`, tokens are mapped to a maximum profile through either:

- `MCP_HTTP_AUTH_TOKEN` plus optional `MCP_HTTP_AUTH_EXPOSURE`;
- `MCP_HTTP_AUTH_TOKENS_JSON` for multi-token or multi-upstream setups.

Example:

```bash
export MCP_HTTP_AUTH_TOKENS_JSON='{
  "REPLACE_ME_SAFE_TOKEN":"safe",
  "REPLACE_ME_OPS_TOKEN":"ops",
  "REPLACE_ME_ADMIN_TOKEN":"admin",
  "REPLACE_ME_ALL_TOKEN":"all"
}'
```

For one HTTP server that fronts multiple upstream MCPHub instances, tokens can also pin an upstream profile:

```bash
export MCP_HTTP_AUTH_TOKENS_JSON='{
  "REPLACE_ME_PROD_SAFE_TOKEN":{"exposureProfile":"safe","upstreamProfileName":"primary"},
  "REPLACE_ME_STAGING_SAFE_TOKEN":{"exposureProfile":"safe","upstreamProfileName":"staging"}
}'
```

With `MCP_HTTP_AUTH_MODE=oauth`, the server introspects incoming bearer tokens and derives the granted exposure from `mcp_profile` or `scope`.

With `MCP_HTTP_AUTH_MODE=better-auth`, the server forwards the inbound `Cookie` header to the upstream MCPHub `/api/better-auth/user` endpoint and grants the configured exposure when the upstream session is valid.

Treat Better Auth bridge mode as high trust. It is appropriate only when the deployment is intentionally allowed to hold live browser session cookies.

`MCP_HTTP_AUTH_MODE=hybrid` enables all three mechanisms in precedence order: static token map, OAuth introspection, then Better Auth bridge.

See [auth-modes.md](./auth-modes.md) for complete examples.

## Transport Safeguards

- default bind host is `127.0.0.1`
- host allowlist from `MCP_HTTP_ALLOWED_HOSTS`
- origin allowlist from `MCP_HTTP_ALLOWED_ORIGINS`
- request body size limit from `MCP_HTTP_BODY_LIMIT`
- in-memory rate limiting per credential fingerprint and path
- `cache-control: no-store`

## Example Requests

Health probe:

```bash
curl -fsS http://127.0.0.1:7345/healthz
```

Authenticated initialize request:

```bash
export SAFE_TOKEN="REPLACE_ME_SAFE_TOKEN"

curl -fsS \
  -H "Authorization: Bearer $SAFE_TOKEN" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:7345/mcp/safe \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}'
```

Stateless `server/discover` request:

```bash
export SAFE_TOKEN="REPLACE_ME_SAFE_TOKEN"

curl -fsS \
  -H "Authorization: Bearer $SAFE_TOKEN" \
  -H "Origin: https://allowed.example" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2026-07-28" \
  -H "Mcp-Method: server/discover" \
  http://127.0.0.1:7345/mcp/safe \
  -d '{"jsonrpc":"2.0","id":"discover-1","method":"server/discover","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientInfo":{"name":"curl","version":"1.0.0"},"io.modelcontextprotocol/clientCapabilities":{}}}}'
```

## Reverse Proxy

Run the node process on localhost and terminate TLS in a reverse proxy such as Caddy.

Recommended proxy behavior:

- terminate TLS at the reverse proxy
- do not expose the Node listener directly to the public internet unless that is an explicit deployment choice
- ensure `MCP_HTTP_ALLOWED_HOSTS` includes the public hostname forwarded by the proxy
- keep `MCP_HTTP_ALLOWED_ORIGINS` exact; do not use `*` for browser-accessible deployments
- keep `admin` and `all` endpoints on private networks, VPNs, or other tightly controlled paths unless there is a strong reason not to
- preserve `Host`
- forward `X-Forwarded-Proto`
- keep request bodies intact
- do not cache MCP POST responses

Rate limiting in this transport is intentionally in-memory and single-instance. For internet-facing deployments, enforce additional limits at Caddy, the ingress controller, API gateway, or WAF layer.

See [caddy.md](./caddy.md) for a working Caddyfile.

## Related Documents

- [getting-started.md](./getting-started.md)
- [runtime-modes.md](./runtime-modes.md)
- [deployment.md](./deployment.md)
- [auth-modes.md](./auth-modes.md)
