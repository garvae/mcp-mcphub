# Minimal Configuration

This document is the shortest path to a working setup.

If you want the full variable catalog, read [configuration.md](./configuration.md).

## Smallest `stdio` Setup

Use this when one local MCP client launches the server as a child process.

```bash
export MCPHUB_URL="https://mcphub-site.com"
export MCPHUB_TOKEN="REPLACE_ME"

npx @garvae/mcp-mcphub stdio --exposure=safe
```

That is enough for the normal bearer-token happy path because these defaults are already built in:

- `MCPHUB_TOKEN_KIND=bearer`
- `MCPHUB_AUTH_HEADER=Authorization`

Use extra upstream auth variables only when you intentionally switch to JWT, OAuth, or Better Auth modes.

## Smallest Local HTTP Setup

Use this when you want a local MCP endpoint instead of child-process stdio.

```bash
export MCPHUB_URL="https://mcphub-site.com"
export MCPHUB_TOKEN="REPLACE_ME"
export MCP_HTTP_AUTH_TOKEN="REPLACE_ME_SAFE_TOKEN"

npx @garvae/mcp-mcphub http
```

The single-token shortcut above is equivalent to:

```bash
export MCP_HTTP_AUTH_TOKENS_JSON='{"REPLACE_ME_SAFE_TOKEN":"safe"}'
```

If you want a different HTTP exposure, add:

```bash
export MCP_HTTP_AUTH_EXPOSURE="admin"
```

## `.env` Example

You can place the same values into a local `.env` file and run the CLI from that directory.

```dotenv
MCPHUB_URL=https://mcphub-site.com
MCPHUB_TOKEN=REPLACE_ME
MCP_HTTP_AUTH_TOKEN=REPLACE_ME_SAFE_TOKEN
```

The CLI loads `.env` automatically when:

- the current working directory contains `.env`;
- you do not pass `--config`.

## What Is Actually Required

### Required almost always

| Variable | Why |
| --- | --- |
| `MCPHUB_URL` | tells the server which MCPHub instance to manage |
| `MCPHUB_TOKEN` | authenticates this server to that MCPHub instance |

### Required only for HTTP mode

| Variable | Why |
| --- | --- |
| `MCP_HTTP_AUTH_TOKEN` or `MCP_HTTP_AUTH_TOKENS_JSON` | authenticates clients calling this MCP server over HTTP |

### Optional defaults most users can ignore

| Variable | Default | Why it exists |
| --- | --- | --- |
| `MCPHUB_TOKEN_KIND` | `bearer` | switch only for alternate upstream auth modes |
| `MCPHUB_AUTH_HEADER` | `Authorization` | switch only for MCPHub deployments that expect `x-auth-token` |
| `MCP_HTTP_AUTH_EXPOSURE` | `safe` | changes the profile granted by `MCP_HTTP_AUTH_TOKEN` |

## Quick Verification

Run:

```bash
npx @garvae/mcp-mcphub doctor
```

The command should confirm:

- config loaded;
- upstream reachable;
- credential accepted.

For machine-readable diagnostics:

```bash
npx @garvae/mcp-mcphub doctor --json
```
