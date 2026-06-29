# Upstream MCPHub

This package is an independent management-layer integration for MCPHub.

It is not the upstream MCPHub project and it should not be described as an official MCPHub package unless upstream maintainers explicitly adopt it later.

## Official References

- Repository: [samanhappy/mcphub](https://github.com/samanhappy/mcphub)
- Documentation: [docs.mcphub.app](https://docs.mcphub.app/)
- API reference: [docs.mcphub.app/api-reference/introduction](https://docs.mcphub.app/api-reference/introduction)
- AI-friendly docs index: [docs.mcphub.app/llms.txt](https://docs.mcphub.app/llms.txt)

## Relationship

This project wraps MCPHub management endpoints exposed under `/api/*` and turns them into:

- typed `mcphub_*` tools
- profile-aware MCP transports
- safer defaults for redaction, confirmations, and feature-gated dangerous operations

It does not replace:

- MCPHub's own downstream `/mcp` runtime gateway
- MCPHub's UI
- MCPHub's official CLI and deployment tooling

## Compatibility Baseline

- Verified baseline: `samanhappy/mcphub@v1.0.15`
- Weekly pinned release target: `1.0.20`
- Fresh upstream smoke target: `latest`

See [compatibility.md](./compatibility.md) for the generated matrix and [api-coverage.md](./api-coverage.md) for route-level classification.

## Route Drift Policy

- New upstream management routes should fail route-drift and coverage checks until they are classified.
- Internal-only or runtime-dynamic upstream routes may remain intentionally unexposed.
- Tool catalogs should be regenerated from the registry and coverage matrix whenever route coverage changes.

## Token Guidance

This package consumes MCPHub management credentials. For the least surprising first-run path:

- use a system-level bearer key when your MCPHub version supports it cleanly
- verify the credential with `doctor`
- prefer normal management endpoints such as `GET /api/servers` for manual bearer smoke checks

If your MCPHub deployment uses JWT, OAuth, or Better Auth, see [auth-modes.md](./auth-modes.md) and the official MCPHub docs for the exact upstream flow.

## Version Policy

- Versions below `1.0.15` are best-effort only.
- The weekly automation refreshes the pinned release target through a pull request instead of editing workflow YAML manually.
