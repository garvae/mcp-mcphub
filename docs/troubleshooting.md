# Troubleshooting

## `doctor` reports config validation errors

Typical causes:

- missing `MCPHUB_URL`
- no upstream credential configured
- HTTP auth mode selected without matching HTTP auth variables

Start from [minimal-config.md](./minimal-config.md) and add only the variables your chosen auth mode requires.

## Node version is rejected

This package requires Node.js `22.13+`.

Check:

```bash
node --version
```

If the version is outside `>=22.13 <25`, switch to Node 22 LTS or Node 24 and rerun `doctor`.

## Upstream MCPHub URL is reachable in the browser but `doctor` still fails

Check:

- the URL includes the correct scheme
- your MCPHub instance exposes the management API you expect
- your reverse proxy is not rewriting the management path unexpectedly

Start with:

```text
MCPHUB_URL=https://mcphub-site.com
```

and avoid extra path suffixes unless your deployment requires them.

## Bearer token is rejected

Check:

- the token really belongs to the MCPHub instance named in `MCPHUB_URL`
- `MCPHUB_TOKEN_KIND=bearer`
- `MCPHUB_AUTH_HEADER=Authorization` unless your deployment expects `x-auth-token`

For manual smoke checks, prefer `GET /api/servers` instead of `/api/auth/keys`.

## HTTP mode starts but clients cannot connect

Check:

- `MCP_HTTP_AUTH_TOKEN` or `MCP_HTTP_AUTH_TOKENS_JSON`
- the client is calling the right endpoint path such as `/mcp/safe`
- the client sends the expected bearer token
- `MCP_HTTP_ALLOWED_HOSTS` and `MCP_HTTP_ALLOWED_ORIGINS` are not rejecting the request

## Elevated tools are missing

The most common causes are:

- the client connected to the wrong profile
- dangerous feature flags are still disabled
- `MCP_FORCE_READONLY=true`

Review:

- [exposure-profiles.md](./exposure-profiles.md)
- [security.md](./security.md)
- [generated/README.md](./generated/README.md)

## Server creation or update is rejected because of command or URL validation

This is usually expected behavior.

The registry blocks:

- stdio `command` payloads unless `ALLOW_STDIO_SERVER_CREATE=true`
- literal private-network URLs
- `localhost` targets
- disallowed hostnames when `MCP_ALLOWED_TARGET_HOSTS` is configured

## Real or compatibility tests do not run locally

Check whether you enabled the required opt-in environment variables:

- `RUN_MCPHUB_COMPAT_TESTS=1`
- `RUN_REAL_MCPHUB_TESTS=1`

See [testing.md](./testing.md) for the exact requirements.
