# Deployment

## First Principle

This project does not require Docker for normal local use.

Recommended order:

1. `npx` + `stdio` for local single-client usage
2. `npx` + local HTTP for transport debugging or local shared access
3. npm or Docker deployment for shared/server-side environments

See [getting-started.md](./getting-started.md) and [runtime-modes.md](./runtime-modes.md) before choosing a deployment shape.

## No-Install Local Start

```bash
npx @garvae/mcp-mcphub stdio --exposure=safe
```

or:

```bash
npx @garvae/mcp-mcphub http
```

## Local npm Installation

```bash
pnpm add -g @garvae/mcp-mcphub
```

Run locally:

```bash
mcp-mcphub doctor
mcp-mcphub http
```

## Docker

Use Docker when you want:

- a reproducible packaged runtime;
- Compose or container-platform deployment;
- a self-built container image instead of a local Node toolchain;
- infrastructure automation or CI validation;
- real-image compatibility testing.

Do not treat Docker as the primary onboarding path for local workstation clients.

Build locally:

```bash
docker build -t mcp-mcphub:local .
```

Run locally:

```bash
docker run --rm \
  -p 7345:7345 \
  -e MCPHUB_URL="https://mcphub-site.com" \
  -e MCPHUB_TOKEN="REPLACE_ME" \
  -e MCP_HTTP_AUTH_TOKENS_JSON='{"REPLACE_ME_SAFE_TOKEN":"safe"}' \
  mcp-mcphub:local http
```

Docker is optional and self-build only. The official distribution channel is the npm package `@garvae/mcp-mcphub`.

## Docker Compose

See [../docker-compose.example.yml](../docker-compose.example.yml).

Recommended usage:

- keep the node process or container private behind a reverse proxy unless there is a strong reason not to;
- keep secrets in a real `.env` file or a secret manager;
- bind the HTTP port only behind a reverse proxy;
- keep `MCP_HTTP_ALLOWED_HOSTS` and `MCP_HTTP_ALLOWED_ORIGINS` explicit.

## CI and Release Workflows

- `ci.yml`: typecheck, lint, tests, build, package smoke, tarball audit, installed-runtime package tests, publish dry-run
- `compatibility-matrix.yml`: real upstream MCPHub version matrix via `testcontainers`
- `real-behavior.yml`: scheduled/manual live checks against a dedicated MCPHub test instance
- `docker.yml`: validate that the Docker build still works for container users
- `release.yml`: changesets-based release PR or publish flow on `main`, guarded by `pnpm test:release-gate`
- `upstream-routes-watch.yml`: nightly upstream route drift detection

## Rollback

Application rollback is straightforward because the server is stateless:

1. redeploy the previous image or npm package version;
2. keep the same HTTP auth-token mapping if possible;
3. re-run `mcp-mcphub doctor`;
4. confirm `/healthz` and one safe MCP call.

## Production Checklist

- `doctor` warnings reviewed
- public exposure disabled unless reverse proxy and auth are configured
- explicit profile-to-token mapping in place
- redaction enabled
- dangerous feature flags justified and documented
- route coverage tests green before release
- installed tarball runtime tests green before release
- live read-only checks configured for release if your policy requires them
