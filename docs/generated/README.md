# Generated Catalogs

This directory is generated from the tool registry and coverage matrix.

## Tool Catalogs

| Profile | Tools | Markdown | JSON |
| --- | --- | --- | --- |
| `safe` | 57 | [tools.safe.md](./tools.safe.md) | [tools.safe.json](./tools.safe.json) |
| `ops` | 76 | [tools.ops.md](./tools.ops.md) | [tools.ops.json](./tools.ops.json) |
| `admin` | 104 | [tools.admin.md](./tools.admin.md) | [tools.admin.json](./tools.admin.json) |
| `all` | 109 | [tools.all.md](./tools.all.md) | [tools.all.json](./tools.all.json) |

## Coverage

- [api-coverage.json](./api-coverage.json): machine-readable coverage export derived from the canonical matrix.

## Regeneration

- Run `pnpm docs:tools` to refresh the tool catalogs.
- Run `pnpm docs:coverage` to refresh the coverage markdown and JSON.
- Run `pnpm docs:tools:check` and `pnpm docs:coverage:check` in CI to detect drift.
