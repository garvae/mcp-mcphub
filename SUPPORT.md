# Support

Use the routing below so questions stay useful and issues stay actionable.

## Use GitHub Discussions For

- setup questions
- client configuration help
- usage Q&A
- workflow ideas that are not yet concrete implementation work

When Discussions are enabled for the public repository, that should be the default home for setup and client help. Until then, use this document as the routing source of truth.

## Use GitHub Issues For

- reproducible bugs
- documentation defects
- concrete feature requests
- upstream compatibility drift

## Use Security Reporting For

- secret disclosure
- auth bypass
- exposure-profile escape
- SSRF or unsafe command-execution paths
- any report that should not be public

Follow [SECURITY.md](./SECURITY.md) for the reporting path.

## Do Not Post Publicly

Do not post real:

- tokens
- cookies
- client secrets
- private URLs
- production logs with sensitive values
- unredacted `doctor --json` output

## What to Include for Setup Help

For setup or client-config help, include:

- OS
- Node.js version
- package version
- MCPHub version
- transport mode
- exposure profile
- relevant feature flags
- `doctor --json` output with secrets redacted

If you open an issue instead of a Discussion, keep it specific: include the exact command or client config you used, what you expected, and what happened.
