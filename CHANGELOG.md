<!-- markdownlint-disable-file MD024 -->

# Changelog

## 1.0.1

### Patch Changes

- c1d6593: Remove self-hosted-only positioning and clean npm-facing README badges.
- 2071b09: Document the public support and security routing updates and switch release automation to the current npm bootstrap publish fallback.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-19

### Added

- typed MCPHub REST client families with retry, auth, schema, and error handling
- profile-aware MCP tool registry for `safe`, `ops`, `admin`, and `all`
- stdio and Streamable HTTP transports over one shared runtime
- route snapshot coverage baseline for `samanhappy/mcphub@v1.0.15`
- security guardrails for redaction, confirmations, stdio command gating, and private-host blocking
- packaging, CI, release, and Docker workflows
- full product documentation set and ADR index
