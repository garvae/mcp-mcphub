# Getting Started

This project is designed to be usable in two very different ways:

1. as a lightweight local MCP server launched by a client process over `stdio`;
2. as a long-running shared HTTP MCP service.

The lightweight local path is the default mental model. Docker is optional.

## Choose a Runtime Mode

Use this decision table first:

| Goal                                                              | Recommended mode            | Why                                                          |
| ----------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------ |
| Connect one local MCP client on your workstation                  | `stdio` via `npx`           | Smallest setup, no listener, no deployment layer             |
| Test the server locally from a browser, curl, or multiple clients | local HTTP via `npx`        | Easy inspection and local debugging                          |
| Run the server as a shared internal service                       | HTTP behind a reverse proxy | Stable network endpoint, token mapping, profile segmentation |
| Package it for CI, Compose, or server deployment                  | Docker                      | Reproducible runtime and easier ops workflows                |

## Fastest Local Start

The smallest working setup is `stdio` over `npx`.

```bash
export MCPHUB_URL="https://mcphub-site.com"
export MCPHUB_TOKEN="REPLACE_ME"

npx @garvae/mcp-mcphub stdio --exposure=safe
```

You can either:

- export variables in the shell before launch;
- or place them in a local `.env` file in the current working directory and run the CLI from that directory.

Recommended upstream credential:

- a system-level bearer key;
- `kind=system`;
- `accessType=all`.

Minimal variables you actually need for this first run:

| Variable       | Required            | Why                                                 |
| -------------- | ------------------- | --------------------------------------------------- |
| `MCPHUB_URL`   | yes                 | points this server at the MCPHub instance to manage |
| `MCPHUB_TOKEN` | yes for bearer mode | authenticates to that MCPHub instance               |

Defaults already applied in the normal bearer path:

- `MCPHUB_TOKEN_KIND=bearer`
- `MCPHUB_AUTH_HEADER=Authorization`

Everything else is optional for the default local `stdio` path.

## Local HTTP Start

Use HTTP when you want a local MCP endpoint instead of child-process stdio.

```bash
export MCPHUB_URL="https://mcphub-site.com"
export MCPHUB_TOKEN="REPLACE_ME"
export MCP_HTTP_AUTH_TOKEN="REPLACE_ME_SAFE_TOKEN"

npx @garvae/mcp-mcphub http
```

Default bind:

```text
127.0.0.1:7345
```

Additional variable needed for the smallest HTTP setup:

| Variable                                             | Required                                  | Why                                                                     |
| ---------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| `MCP_HTTP_AUTH_TOKEN` or `MCP_HTTP_AUTH_TOKENS_JSON` | yes for the default static HTTP auth mode | defines which local inbound token can access which MCP exposure profile |

Important distinction:

- `MCPHUB_TOKEN` authenticates from this server to upstream MCPHub;
- `MCP_HTTP_AUTH_TOKEN` or `MCP_HTTP_AUTH_TOKENS_JSON` authenticates from your local HTTP client to this server.

## Bearer Token Validation

When validating an upstream MCPHub bearer key manually, prefer a normal management endpoint such as:

Example:

```text
GET https://mcphub-site.com/api/servers
Authorization: Bearer <your MCPHub bearer key>
```

Do not use `/api/auth/keys` as your first bearer smoke-check.
Some MCPHub versions expose bearer-key management in a way that still rejects bearer-key callers on that route even when the same token works on the wider management API.

## What the Server Actually Does

This server manages MCPHub itself.

It wraps MCPHub's REST Management API:

```text
/api/*
```

It does not replace or proxy MCPHub's downstream gateway as a generic raw MCP passthrough.

The server exposes:

- typed `mcphub_*` tools;
- filtered capability profiles;
- safe defaults;
- secret redaction;
- confirmations for destructive actions.

## Exposure Profiles

| Profile | What it is for                                          |
| ------- | ------------------------------------------------------- |
| `safe`  | read-only inventory and diagnostics                     |
| `ops`   | reversible operational actions                          |
| `admin` | administrative CRUD and sensitive control-plane actions |
| `all`   | maximum supported API surface                           |

The practical guidance is simple:

- start with `safe`;
- move to `ops` only when the client must change live runtime state;
- use `admin` or `all` only for trusted maintenance workflows.

## Local Client Examples

### Codex over stdio

```toml
[mcp_servers.mcphub_safe]
command = "npx"
args = ["-y", "@garvae/mcp-mcphub", "stdio", "--exposure=safe"]
env_vars = ["MCPHUB_URL", "MCPHUB_TOKEN"]
startup_timeout_sec = 20
tool_timeout_sec = 90
enabled = true
```

### Claude Desktop style config

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

## Where to Go Next

- [stdio.md](./stdio.md): local child-process mode
- [streamable-http.md](./streamable-http.md): HTTP mode and protocol eras
- [runtime-modes.md](./runtime-modes.md): when to use `stdio`, local HTTP, or Docker
- [minimal-config.md](./minimal-config.md): smallest env set for first run
- [configuration.md](./configuration.md): environment variables and JSON profile formats
- [auth-modes.md](./auth-modes.md): upstream auth and inbound HTTP auth
- [deployment.md](./deployment.md): package, Docker, Compose, CI, and rollback
- [managed-gateway-integration.md](./managed-gateway-integration.md): launcher and shared-gateway integration notes
