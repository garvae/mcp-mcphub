# ADR 0004: Dual transport runtime

## Status

Accepted

## Context

The project needs both local stdio support and remotely hosted Streamable HTTP support.

## Decision

Keep stdio and HTTP as separate entrypoints over the same managed MCP server and tool registry.

## Consequences

- client-facing transport choices do not fork business logic;
- tests can cover transport behavior independently;
- future spec migrations can stay transport-scoped.
