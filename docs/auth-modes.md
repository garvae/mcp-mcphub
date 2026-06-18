# Authentication Modes

`@garvae/mcp-mcphub` has two independent authentication surfaces:

- inbound HTTP clients authenticating to this MCP server;
- the shared REST client authenticating from this MCP server to upstream MCPHub.

The modes can be combined, but they solve different problems.

## HTTP Client Authentication

### Static bearer map

Use `MCP_HTTP_AUTH_MODE=static` when you want a small, explicit token inventory.

```dotenv
MCP_HTTP_AUTH_MODE=static
MCP_HTTP_AUTH_TOKENS_JSON={"REPLACE_ME_SAFE_TOKEN":"safe","REPLACE_ME_ADMIN_TOKEN":"admin"}
```

This is the default mode. It is simple, deterministic, and works well for local agents, CI, and reverse-proxy deployments.

### OAuth introspection

Use `MCP_HTTP_AUTH_MODE=oauth` when your MCP clients already carry OAuth access tokens and your deployment can introspect them.

```dotenv
MCP_HTTP_AUTH_MODE=oauth
MCP_HTTP_OAUTH_INTROSPECTION_URL=https://auth.example.com/introspect
MCP_HTTP_OAUTH_CLIENT_ID=mcphub-management-mcp
MCP_HTTP_OAUTH_CLIENT_SECRET=REPLACE_ME
MCP_HTTP_OAUTH_REQUIRED_SCOPE=mcphub:admin
MCP_HTTP_OAUTH_EXPOSURE_FALLBACK=safe
MCP_HTTP_OAUTH_UPSTREAM_PROFILE=primary
```

Behavior:

- bearer tokens are POSTed to the introspection endpoint as `application/x-www-form-urlencoded`;
- inactive tokens are rejected with HTTP `401`;
- if the introspection payload includes `mcp_profile`, that profile wins;
- otherwise the server derives exposure from scopes: `all`, `admin`, `ops`, then `safe`;
- `MCP_HTTP_OAUTH_REQUIRED_SCOPE` is enforced before any tool is exposed.

### Better Auth bridge

Use `MCP_HTTP_AUTH_MODE=better-auth` when the inbound caller already holds a valid MCPHub Better Auth session cookie.

```dotenv
MCP_HTTP_AUTH_MODE=better-auth
MCP_HTTP_BETTER_AUTH_EXPOSURE=safe
MCP_HTTP_BETTER_AUTH_UPSTREAM_PROFILE=primary
```

Behavior:

- the incoming `Cookie` header is forwarded to upstream `GET /api/better-auth/user`;
- a successful upstream response grants the configured exposure;
- the session is never converted into a long-lived local token.

Treat this mode as high trust. It is best suited to tightly controlled internal deployments, not as a generic replacement for narrow-scoped machine credentials.

### Hybrid mode

Use `MCP_HTTP_AUTH_MODE=hybrid` when a single endpoint must accept multiple client credential styles.

```dotenv
MCP_HTTP_AUTH_MODE=hybrid
MCP_HTTP_AUTH_TOKENS_JSON={"breakglass-admin":"admin"}
MCP_HTTP_OAUTH_INTROSPECTION_URL=https://auth.example.com/introspect
MCP_HTTP_BETTER_AUTH_EXPOSURE=safe
```

Resolution order:

1. static token map;
2. OAuth introspection;
3. Better Auth bridge.

## Upstream MCPHub Authentication

### Static bearer key

Recommended for production automation.

```dotenv
MCPHUB_URL=https://mcphub-site.com
MCPHUB_TOKEN_KIND=bearer
MCPHUB_TOKEN=REPLACE_ME
```

### JWT login

Useful when bearer keys are unavailable and the upstream instance still exposes `/api/auth/login`.

```dotenv
MCPHUB_URL=https://mcphub-site.com
MCPHUB_TOKEN_KIND=jwt
MCPHUB_USERNAME=admin
MCPHUB_PASSWORD=REPLACE_ME
```

The client caches the issued JWT and refreshes it automatically when it expires.

### OAuth client credentials

Use when the upstream MCPHub deployment expects OAuth access tokens and provides a token endpoint.

```dotenv
MCPHUB_URL=https://mcphub-site.com
MCPHUB_TOKEN_KIND=oauth
MCPHUB_OAUTH_CLIENT_ID=mcphub-management-mcp
MCPHUB_OAUTH_CLIENT_SECRET=REPLACE_ME
MCPHUB_OAUTH_TOKEN_URL=https://mcphub-site.com/oauth/token
MCPHUB_OAUTH_SCOPE=mcphub:admin
```

The REST client exchanges client credentials for an access token and reuses it until invalidated.

### Better Auth cookie

Use only when the MCP runtime is explicitly allowed to hold a Better Auth session cookie.

```dotenv
MCPHUB_URL=https://mcphub-site.com
MCPHUB_TOKEN_KIND=better-auth
MCPHUB_BETTER_AUTH_COOKIE=session=REPLACE_ME
```

This mode forwards the cookie as-is to upstream MCPHub requests.

## Operational Guidance

- Prefer static bearer keys for unattended service-to-service usage.
- Use OAuth introspection only if you already operate a trusted authorization server.
- Treat Better Auth bridge mode as high-trust session passthrough, not as a substitute for narrow-scoped service credentials.
- Keep OAuth client secrets and Better Auth cookies in environment variables or a secret manager, never in committed config files.
