# Security

## Threat Model

This server is designed to give agents broad MCPHub management access without pretending dangerous operations do not exist.

Primary risks:

- credential leakage through tool outputs or logs
- destructive configuration changes without deliberate operator intent
- SSRF through remote MCP server definitions
- accidental exposure of an overpowered profile to the wrong client
- misuse of stdio-based server creation to execute arbitrary local commands

## Security Controls

### 1. Exposure profiles

The first security boundary is profile filtering:

- `safe` for read-only access
- `ops` for reversible operational actions
- `admin` for CRUD and high-trust administration
- `all` for the most dangerous supported endpoints

The server enforces this boundary when it registers tools for a transport.

### 2. Safe defaults

Dangerous feature-flagged surfaces are disabled by default in both runtime config and the exported programmatic registry:

- `ALLOW_AUTH_ADMIN_TOOLS`
- `ALLOW_STDIO_SERVER_CREATE`
- `ALLOW_MCPB_UPLOAD`
- `ALLOW_SYSTEM_CONFIG_WRITE`

Programmatic callers must opt in explicitly through `featureFlags` when they want those surfaces.

### 3. Redaction

Normal outputs pass through a redactor before they are returned to MCP clients.

Patterns include:

- `Authorization` and `x-auth-token` values
- bearer tokens and JWT-like blobs
- private keys and API-key style strings
- sensitive config values embedded in settings snapshots and logs

Redaction can be disabled with `MCP_REDACT_SECRETS=false`, but `doctor` warns when that happens.

### 4. Structured confirmations

Destructive tools require confirmation fields such as:

```json
{
  "confirm": true,
  "expectedName": "target-name",
  "reason": "why the change is needed"
}
```

This is enforced in tool schemas, not documented as a client-side convention only.

### 5. HTTP transport hardening

HTTP mode applies:

- bearer-token authentication or configured OAuth/Better Auth modes
- profile ceiling per token
- host allowlist checks
- origin allowlist checks
- request body size limits
- simple rate limiting
- `cache-control: no-store`

### 6. Server mutation validation

When creating or updating MCPHub server definitions, the registry:

- recursively inspects URL-bearing payload fields, including nested objects and arrays
- blocks non-HTTP schemes and literal localhost/private-network URLs
- can enforce explicit hostname allowlists through `MCP_ALLOWED_TARGET_HOSTS`
- rejects stdio `command` payloads unless `ALLOW_STDIO_SERVER_CREATE=true`

For any `admin` or `all` deployment that can reach arbitrary networks, treat `MCP_ALLOWED_TARGET_HOSTS` as strongly recommended rather than optional.

### 7. Audit logging

When `MCP_AUDIT_FILE` is set, the server writes dedicated audit events to that file with rotation controls:

- `MCP_AUDIT_MAX_BYTES`
- `MCP_AUDIT_MAX_FILES`

Do not assume audit logging is enabled unless the deployment sets `MCP_AUDIT_FILE`.

### 8. Description linting

Update handlers for prompt, resource, and tool descriptions reject obviously unsafe descriptions, including secret-like tokens and overly large payloads.

## Operational Guidance

- Prefer system-level bearer keys with `accessType=all` for the upstream MCPHub client.
- Keep `safe` as the default profile for human-facing local clients.
- Use separate HTTP bearer tokens per consumer and map them to the smallest acceptable profile.
- Prefer static tokens or OAuth machine credentials for automation; treat Better Auth bridge mode as a high-trust session passthrough.
- Use `MCP_FORCE_READONLY=true` or `--readonly` when elevated profiles should remain visible but mutations must still be impossible.
- Keep public bind hosts behind a reverse proxy and explicit host/origin allowlists.

## Known Limitations

- DNS-based SSRF protection is not implemented yet.
- Some read-only endpoints can still contain operationally sensitive information even when secrets are redacted.
- Generated tool catalogs describe feature-flag requirements, but the runtime `tools/list` response remains the final source of truth for exact schemas.
