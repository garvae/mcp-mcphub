# ADR 0002: Profile filtering

## Status

Accepted

## Context

The project must expose dangerous MCPHub operations without pretending they are safe for all clients.

## Decision

Expose one shared tool registry through cumulative profiles: `safe`, `ops`, `admin`, `all`.

## Consequences

- transports can stay thin;
- tool metadata stays consistent;
- operators can choose the smallest acceptable surface for each client.
