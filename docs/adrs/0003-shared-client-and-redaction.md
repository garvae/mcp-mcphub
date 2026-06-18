# ADR 0003: Shared client and redaction

## Status

Accepted

## Context

The same upstream management surface is used by multiple transports and many tools. Secret leakage must be handled consistently.

## Decision

Keep one typed MCPHub REST client and one redaction layer in shared runtime code.

## Consequences

- schema validation stays centralized;
- retry, auth, and error behavior are consistent;
- redaction is applied before outputs return to MCP clients.
