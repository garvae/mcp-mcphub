# ADR 0005: Security guardrails

## Status

Accepted

## Context

This server can mutate upstream MCPHub state, including credentials and server definitions.

## Decision

Use multiple explicit guardrails: profile filtering, confirmations, feature flags, output redaction, and mutation validation for high-risk inputs.

## Consequences

- powerful tools remain available for trusted operators;
- dangerous operations require deliberate opt-in;
- the security model is visible in code and documentation.
