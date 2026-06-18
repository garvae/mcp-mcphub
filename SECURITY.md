# Security Policy

## Supported Versions

Security fixes are applied to the current main development line and the latest published npm release when practical.

## What to Report

Please report issues that could lead to:

- secret disclosure
- auth bypass
- privilege escalation across exposure profiles
- SSRF
- unsafe stdio command execution
- dangerous system-config writes without intended gating

## How to Report

Preferred path:

- follow the repository's private vulnerability reporting path if it is available
- use GitHub Security Advisories / Private Vulnerability Reporting when the repository has that feature enabled

Fallback path:

- contact the repository owner privately through GitHub and avoid posting exploit details publicly

If neither private path is available, open a minimal public issue without reproduction secrets, exploit payloads, or private infrastructure details.

## What to Include

- affected version or commit
- exposure profile involved
- transport mode involved
- exact feature flags required
- reproduction steps with placeholders instead of real credentials
- impact assessment

## Response Expectations

- reports are triaged as quickly as practical
- fixes may land privately first and then be published with notes
- public proof-of-concept details may be delayed until a fix exists
