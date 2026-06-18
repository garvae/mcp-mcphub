# Configuration

## Overview

Configuration is environment-driven.

CLI loading order:

1. if the current working directory contains `.env`, the CLI loads it automatically;
2. `--config <path>` can be used to load another env-style file or a JSON object instead;
3. explicit process environment variables override file values.

Read [`../.env.example`](../.env.example) first if you want a commented template.

The biggest source of confusion is that this project has two separate credential layers:

- upstream MCPHub credentials: how this server logs in to the MCPHub instance it manages;
- inbound HTTP credentials: how external clients log in to this MCP server when HTTP mode is enabled.

The smallest useful local configuration is usually:

```dotenv
MCPHUB_URL=https://mcphub-site.com
MCPHUB_TOKEN=REPLACE_ME
```

Defaults already applied in the normal bearer path:

- `MCPHUB_TOKEN_KIND=bearer`
- `MCPHUB_AUTH_HEADER=Authorization`

Add `MCP_HTTP_AUTH_TOKEN` or `MCP_HTTP_AUTH_TOKENS_JSON` only when you run HTTP mode.

## What Is Actually Required

### Required for most users

These are the variables that matter for the normal single-upstream setup:

| Variable | Required | What it is | Where to get it |
| --- | --- | --- | --- |
| `MCPHUB_URL` | yes | Base URL of the MCPHub instance to manage | MCPHub site URL, reverse proxy URL, ingress URL, or internal service URL |
| `MCPHUB_TOKEN` | yes for bearer mode | Static credential used by this server to call upstream MCPHub | Create a bearer/system token in MCPHub or obtain it from your secret store |

### Required only for local HTTP mode

| Variable | Required | What it is | Where to get it |
| --- | --- | --- | --- |
| `MCP_HTTP_AUTH_TOKEN` or `MCP_HTTP_AUTH_TOKENS_JSON` | yes for default `static` HTTP auth | Inbound token or token map for clients calling this MCP server over HTTP | You define and store these local tokens yourself |

### Optional for specialized setups

Everything else is optional and exists for one of these reasons:

- alternate upstream auth modes such as JWT, OAuth, or Better Auth;
- multi-upstream routing with profile selection;
- HTTP hosting and browser/CORS requirements;
- request tuning, audit logging, and explicit security hardening;
- dangerous feature gates that stay off by default.

## Upstream MCPHub Connection

| Variable | Default | Purpose |
| --- | --- | --- |
| `MCPHUB_URL` | none | Base URL for a single upstream MCPHub instance |
| `MCPHUB_TOKEN` | none | Static upstream token |
| `MCPHUB_TOKEN_KIND` | `bearer` | `bearer` or `jwt` |
| `MCPHUB_AUTH_HEADER` | `Authorization` | Upstream auth header selection |
| `MCPHUB_USERNAME` | none | Username for JWT login mode |
| `MCPHUB_PASSWORD` | none | Password for JWT login mode |
| `MCPHUB_OAUTH_CLIENT_ID` | none | OAuth client id for upstream client-credentials mode |
| `MCPHUB_OAUTH_CLIENT_SECRET` | none | OAuth client secret for upstream client-credentials mode |
| `MCPHUB_OAUTH_TOKEN_URL` | none | OAuth token endpoint for upstream client-credentials mode |
| `MCPHUB_OAUTH_SCOPE` | none | Optional upstream OAuth scope |
| `MCPHUB_BETTER_AUTH_COOKIE` | none | Existing MCPHub Better Auth session cookie for passthrough mode |
| `MCPHUB_PROFILES_JSON` | none | Named upstream profiles for multi-instance usage |
| `MCPHUB_DEFAULT_PROFILE` | `default` | Default entry from `MCPHUB_PROFILES_JSON` |

Detailed guidance:

- `MCPHUB_URL`: use the exact base URL you would open in a browser to reach MCPHub.
- `MCPHUB_TOKEN`: usually a service credential created specifically for automation. Prefer this over reusing a browser cookie.
- `MCPHUB_TOKEN_KIND`: keep `bearer` unless you intentionally switch to one of the alternate auth flows in [auth-modes.md](./auth-modes.md).
- `MCPHUB_AUTH_HEADER`: only change this if your MCPHub deployment expects `x-auth-token`.
- `MCPHUB_USERNAME` and `MCPHUB_PASSWORD`: use only for legacy JWT login flows.
- `MCPHUB_OAUTH_CLIENT_ID`, `MCPHUB_OAUTH_CLIENT_SECRET`, `MCPHUB_OAUTH_TOKEN_URL`, `MCPHUB_OAUTH_SCOPE`: use only when the upstream MCPHub deployment is integrated with an OAuth provider and you have a machine-to-machine client registration.
- `MCPHUB_BETTER_AUTH_COOKIE`: use only when you intentionally allow this MCP runtime to hold a live browser session cookie.
- `MCPHUB_PROFILES_JSON`: use when one MCP server should manage several MCPHub environments, for example `primary` and `staging`.
- `MCPHUB_DEFAULT_PROFILE`: selects which profile should be used when a tool call or transport does not choose one explicitly.

## Request Behavior

| Variable | Default | Purpose |
| --- | --- | --- |
| `MCPHUB_REQUEST_TIMEOUT_MS` | `30000` | Timeout for one upstream HTTP request |
| `MCPHUB_REQUEST_RETRY_ATTEMPTS` | `2` | Retry count for transient upstream failures |
| `MCPHUB_REQUEST_RETRY_BACKOFF_MS` | `250` | Delay between retries in milliseconds |

What most users need:

- keep all three defaults.

## MCP Exposure

| Variable | Default | Purpose |
| --- | --- | --- |
| `MCP_DEFAULT_EXPOSURE` | `safe` | Default stdio exposure profile |
| `MCP_EXPOSE_ENDPOINTS` | `safe,ops,admin,all` | HTTP profiles to expose |
| `MCP_FORCE_READONLY` | `false` | Force read-only behavior even on elevated profiles |
| `MCP_REDACT_SECRETS` | `true` | Enable output redaction |
| `MCP_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |

Practical meaning:

- `MCP_DEFAULT_EXPOSURE` matters mainly for `stdio`, because one process usually serves one profile.
- `MCP_EXPOSE_ENDPOINTS` matters only for HTTP mode, because it decides which `/mcp/*` endpoints exist.
- `MCP_FORCE_READONLY` is a hardening switch for debugging or audit environments.
- `MCP_REDACT_SECRETS` should stay `true` in nearly every deployment.
- `MCP_LOG_LEVEL=debug` is for troubleshooting, not steady-state production.

## Audit Logging

| Variable | Default | Purpose |
| --- | --- | --- |
| `MCP_AUDIT_FILE` | none | Optional NDJSON audit log file |
| `MCP_AUDIT_MAX_BYTES` | `1048576` | Rotate audit file after this size |
| `MCP_AUDIT_MAX_FILES` | `5` | Number of rotated audit files to retain |

Use audit logging when:

- you need a local action trail for change reviews or incident analysis.

Skip it when:

- stdout/stderr logs or platform logs are already enough.

## HTTP Transport

| Variable | Default | Purpose |
| --- | --- | --- |
| `MCP_HTTP_HOST` | `127.0.0.1` | HTTP bind host |
| `MCP_HTTP_PORT` | `7345` | HTTP bind port |
| `MCP_HTTP_MODE` | `stateful` | `stateful` for `2025-11-25`, `stateless` for `2026-07-28` |
| `MCP_HTTP_AUTH_MODE` | `static` | `static`, `oauth`, `better-auth`, or `hybrid` |
| `MCP_HTTP_AUTH_TOKEN` | none | Single inbound bearer token shortcut for the default static mode |
| `MCP_HTTP_AUTH_EXPOSURE` | `safe` | Profile granted by `MCP_HTTP_AUTH_TOKEN` |
| `MCP_HTTP_AUTH_TOKENS_JSON` | none | Bearer token to profile mapping |
| `MCP_HTTP_OAUTH_INTROSPECTION_URL` | none | OAuth introspection endpoint for HTTP client tokens |
| `MCP_HTTP_OAUTH_CLIENT_ID` | none | Optional OAuth client id used when introspecting HTTP client tokens |
| `MCP_HTTP_OAUTH_CLIENT_SECRET` | none | Optional OAuth client secret used when introspecting HTTP client tokens |
| `MCP_HTTP_OAUTH_REQUIRED_SCOPE` | none | Optional scope that every introspected HTTP client token must include |
| `MCP_HTTP_OAUTH_EXPOSURE_FALLBACK` | `safe` | Fallback profile when introspection does not return `mcp_profile` |
| `MCP_HTTP_OAUTH_UPSTREAM_PROFILE` | none | Optional upstream MCPHub profile bound to OAuth-authenticated HTTP clients |
| `MCP_HTTP_BETTER_AUTH_EXPOSURE` | `safe` | Exposure granted to Better Auth cookie sessions |
| `MCP_HTTP_BETTER_AUTH_UPSTREAM_PROFILE` | none | Optional upstream MCPHub profile bound to Better Auth sessions |
| `MCP_HTTP_ALLOWED_HOSTS` | `127.0.0.1,localhost` | Accepted `Host` header values |
| `MCP_HTTP_ALLOWED_ORIGINS` | empty | Accepted browser origins |
| `MCP_HTTP_BODY_LIMIT` | `1048576` | Request body limit in bytes |

Detailed guidance:

- `MCP_HTTP_HOST`: keep `127.0.0.1` for local testing; move to `0.0.0.0` or a container bind only intentionally.
- `MCP_HTTP_PORT`: change only if `7345` conflicts locally or your hosting platform dictates a port.
- `MCP_HTTP_MODE`: `stateful` is the normal choice; `stateless` exists for newer protocol semantics.
- `MCP_HTTP_AUTH_MODE`: `static` is the easiest and most predictable mode for local work.
- `MCP_HTTP_AUTH_TOKEN`: the shortest first-run option for local HTTP; use this when one token is enough.
- `MCP_HTTP_AUTH_EXPOSURE`: changes which profile the single-token shortcut grants.
- `MCP_HTTP_AUTH_TOKENS_JSON`: these tokens belong to this MCP server, not to upstream MCPHub. You mint them yourself.
- `MCP_HTTP_ALLOWED_HOSTS`: set this to the actual hostname(s) clients use to reach the service.
- `MCP_HTTP_ALLOWED_ORIGINS`: set this only if browser-based clients must call the HTTP endpoint directly.
- `MCP_HTTP_BODY_LIMIT`: increase only if you knowingly need larger payloads such as imports or uploads.
- `MCP_HTTP_OAUTH_*`: use only if inbound HTTP callers already rely on an OAuth authorization server.
- `MCP_HTTP_BETTER_AUTH_*`: use only if inbound callers authenticate with an MCPHub Better Auth session cookie.

`MCP_HTTP_AUTH_TOKENS_JSON` supports either the legacy shorthand:

```json
{
  "REPLACE_ME_SAFE_TOKEN": "safe"
}
```

`MCP_HTTP_MODE=stateful` keeps the current SDK-backed Streamable HTTP handshake with `initialize` and optional GET-based SSE handling.

`MCP_HTTP_MODE=stateless` switches the HTTP runtime to per-request `2026-07-28` semantics:

- POST-only MCP endpoints;
- no session ids;
- `MCP-Protocol-Version`, `Mcp-Method`, and `Mcp-Name` header validation;
- direct JSON responses for `server/discover`, `tools/*`, `resources/*`, and `prompts/*`.

or the object form for one-server, multi-upstream deployments:

```json
{
  "REPLACE_ME_PROD_SAFE_TOKEN": {
    "exposureProfile": "safe",
    "upstreamProfileName": "primary"
  },
  "REPLACE_ME_STAGING_SAFE_TOKEN": {
    "exposureProfile": "safe",
    "upstreamProfileName": "staging"
  }
}
```

## Dangerous Feature Flags

| Variable | Default | Effect |
| --- | --- | --- |
| `ALLOW_SECRET_EXPORT` | `false` | Reserved for future explicit secret-export flows |
| `ALLOW_STDIO_SERVER_CREATE` | `false` | Allows upstream server definitions with local command execution |
| `ALLOW_AUTH_ADMIN_TOOLS` | `false` | Enables bearer-key, OAuth-client, and user admin flows |
| `ALLOW_MCPB_UPLOAD` | `false` | Enables MCPB bundle uploads |
| `ALLOW_SYSTEM_CONFIG_WRITE` | `false` | Enables system config writes |

These flags are optional and should stay `false` unless you have a specific operational reason:

- `ALLOW_SECRET_EXPORT`: reserved and normally unused.
- `ALLOW_STDIO_SERVER_CREATE`: dangerous because it can enable upstream stdio server definitions with command execution semantics.
- `ALLOW_AUTH_ADMIN_TOOLS`: needed only if you truly want this MCP server to manage identities and auth credentials.
- `ALLOW_MCPB_UPLOAD`: needed only for trusted package upload workflows.
- `ALLOW_SYSTEM_CONFIG_WRITE`: needed only when this MCP server is allowed to change global MCPHub system config.

## Developer Test Harness Variables

These variables do not affect the runtime server itself. They exist only for repository test suites and release validation.

| Variable | Default | Purpose |
| --- | --- | --- |
| `RUN_REAL_MCPHUB_TESTS` | unset | Enables live read-only tests |
| `RUN_REAL_MCPHUB_MUTATION_TESTS` | unset | Enables live mutation tests |
| `REAL_TEST_MCPHUB_URL` | none | Dedicated live MCPHub URL used by the test harness |
| `REAL_TEST_MCPHUB_TOKEN` | none | Dedicated live MCPHub management token used by the test harness |
| `REAL_TEST_HTTP_AUTH_TOKEN` | `real-safe-token` | Local token used by the temporary HTTP test server |
| `REAL_TEST_MCPHUB_AUTH_HEADER` | `Authorization` | Upstream auth header override for the live test harness |
| `REAL_TEST_MCPHUB_TOKEN_KIND` | `bearer` | Upstream auth mode override for the live test harness |
| `REAL_TEST_MCPHUB_PROFILE` | `MCPHUB_DEFAULT_PROFILE` | Upstream profile selection for multi-profile tests |
| `REAL_TEST_FIXTURE_PREFIX` | `mcp-mcphub-test` | Prefix used for live mutation fixtures and cleanup |
| `RELEASE_REAL_TESTS_REQUIRED` | unset | Converts missing live-test secrets from skip into failure inside the release gate |

Use these only when following [testing.md](./testing.md).

## Mutation Allowlist

| Variable | Default | Purpose |
| --- | --- | --- |
| `MCP_ALLOWED_TARGET_HOSTS` | empty | Optional hostname allowlist for URL-bearing upstream server mutations |

Use `MCP_ALLOWED_TARGET_HOSTS` when:

- you want to restrict created or updated upstream server definitions to an approved domain set.

## JSON Examples

### `MCPHUB_PROFILES_JSON`

```json
{
  "primary": {
    "url": "https://mcphub-primary.example.com",
    "tokenEnv": "MCPHUB_PRIMARY_TOKEN",
    "tokenKind": "bearer",
    "authHeader": "Authorization"
  },
  "staging": {
    "url": "https://mcphub-staging.example.com",
    "tokenEnv": "MCPHUB_STAGING_TOKEN",
    "tokenKind": "bearer",
    "authHeader": "Authorization"
  }
}
```

Each upstream profile can also use OAuth client credentials or a Better Auth cookie instead of a static bearer token:

```json
{
  "oauth-prod": {
    "url": "https://mcphub-site.com",
    "tokenKind": "oauth",
    "oauthClientIdEnv": "MCPHUB_OAUTH_CLIENT_ID",
    "oauthClientSecretEnv": "MCPHUB_OAUTH_CLIENT_SECRET",
    "oauthTokenUrl": "https://mcphub-site.com/oauth/token",
    "oauthScope": "mcphub:admin"
  },
  "social-admin": {
    "url": "https://mcphub-site.com",
    "tokenKind": "better-auth",
    "betterAuthCookieEnv": "MCPHUB_BETTER_AUTH_COOKIE"
  }
}
```

### `MCP_HTTP_AUTH_TOKENS_JSON`

```json
{
  "REPLACE_ME_SAFE_TOKEN": "safe",
  "REPLACE_ME_OPS_TOKEN": "ops",
  "REPLACE_ME_ADMIN_TOKEN": "admin",
  "REPLACE_ME_ALL_TOKEN": "all"
}
```

### `MCP_HTTP_AUTH_TOKEN`

Smallest local HTTP setup:

```dotenv
MCP_HTTP_AUTH_TOKEN=REPLACE_ME_SAFE_TOKEN
MCP_HTTP_AUTH_EXPOSURE=safe
```

## Configuration File Example

```dotenv
MCPHUB_URL=https://mcphub-site.com
MCPHUB_TOKEN=REPLACE_ME
MCP_HTTP_AUTH_TOKEN=REPLACE_ME_SAFE_TOKEN
MCP_HTTP_ALLOWED_HOSTS=127.0.0.1,localhost,mcp.example.com
MCP_HTTP_ALLOWED_ORIGINS=https://claude.ai,https://chat.openai.com
```

See [auth-modes.md](./auth-modes.md) for end-to-end examples of static bearer, OAuth introspection, Better Auth bridge, and upstream OAuth or Better Auth credentials.
