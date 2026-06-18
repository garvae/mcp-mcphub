# ADR 0001: Route-first coverage

## Status

Accepted

## Context

Upstream MCPHub exposes a public OpenAPI document, but that document describes downstream tool execution rather than the management API surface that this project needs to wrap.

## Decision

Use the upstream route tree as the primary source of truth for management API coverage and maintain a pinned route snapshot in this repository.

## Consequences

- coverage drift is visible in tests;
- management tools are classified per endpoint;
- documentation and tests share the same canonical matrix.
