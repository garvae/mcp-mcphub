# stdio

## Why stdio

Use stdio for local MCP clients that launch the server as a child process.

This is the default recommended runtime mode for first-time users.

Benefits:

- no HTTP listener exposed;
- credentials stay in local process env or config files;
- one process can be scoped to one profile.

Typical launch pattern:

```bash
npx @garvae/mcp-mcphub stdio --exposure=safe
```

## Basic Usage

```bash
mcp-mcphub stdio --exposure=safe
```

Optional flags:

- `--config <path>`: load env-style or JSON config file
- `--profile <name>`: choose one upstream MCPHub profile from `MCPHUB_PROFILES_JSON`
- `--exposure <safe|ops|admin|all>`: choose the exposed tool set
- `--readonly`: force a read-only surface even when `--exposure` is higher

## Required Environment

```bash
MCPHUB_URL="https://mcphub-site.com"
MCPHUB_TOKEN="REPLACE_ME"
```

Defaults already applied:

- `MCPHUB_TOKEN_KIND=bearer`
- `MCPHUB_AUTH_HEADER=Authorization`

## Claude Desktop Style Example

```json
{
  "mcpServers": {
    "mcphub-safe": {
      "type": "stdio",
      "command": "mcp-mcphub",
      "args": ["stdio", "--exposure=safe"],
      "env": {
        "MCPHUB_URL": "https://mcphub-site.com",
        "MCPHUB_TOKEN": "REPLACE_ME"
      }
    }
  }
}
```

## Codex Example

```toml
[mcp_servers.mcphub_safe]
command = "mcp-mcphub"
args = ["stdio", "--exposure=safe"]
env_vars = ["MCPHUB_URL", "MCPHUB_TOKEN"]
startup_timeout_sec = 20
tool_timeout_sec = 90
enabled = true
```

For fixed values instead of pass-through env vars:

```toml
[mcp_servers.mcphub_safe.env]
MCPHUB_URL = "https://mcphub-site.com"
MCPHUB_TOKEN = "REPLACE_ME"
```

## Operational Notes

- stdout must stay MCP-only; logs go to stderr.
- The process fails fast when required upstream credentials are missing.
- When `MCP_REDACT_SECRETS=true`, tool results are redacted before being returned.
- The server also exposes MCP resources for `mcphub://settings/snapshot` and `mcphub://logs/stream`.

## When to Choose Another Mode

Prefer HTTP instead of stdio when:

- multiple clients need one shared endpoint;
- you want token-based inbound access control at the MCP boundary;
- you are deploying the server remotely;
- you need reverse-proxy integration or shared health checks.

See [runtime-modes.md](./runtime-modes.md) and [streamable-http.md](./streamable-http.md).
