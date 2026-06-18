# Testing

`@garvae/mcp-mcphub` now has four test layers:

1. fast deterministic tests;
2. local transport integration tests;
3. ephemeral Docker compatibility tests;
4. optional live MCPHub tests against a dedicated test instance.

The release path is intentionally stricter than the ordinary PR path.

## Command Matrix

| Command | Purpose | Secrets required | Docker required |
| --- | --- | --- | --- |
| `pnpm test` | unit tests and default deterministic suites | no | no |
| `pnpm test:integration` | local `stdio` and Streamable HTTP transport smoke tests | no | no |
| `pnpm test:coverage-matrix` | route coverage verification | no | no |
| `pnpm test:compatibility` | real MCPHub containers via `testcontainers` | no | yes |
| `pnpm test:package:installed` | build, pack, install tarball, and verify the published runtime surface | no | no |
| `pnpm test:real:readonly` | live `doctor`, `stdio`, `http`, and safe-surface checks against a dedicated MCPHub | yes | no |
| `pnpm test:real:mutation` | controlled create/delete lifecycle checks on namespaced fixtures | yes | no |
| `pnpm cleanup:real-fixtures` | best-effort cleanup of live fixture groups | yes | no |
| `pnpm test:release-gate` | publish-grade validation gate | optional live secrets, depending on policy | yes |

## Fast Local Checks

For normal development:

```bash
pnpm test
pnpm test:integration
pnpm test:coverage-matrix
pnpm test:package:installed
```

This covers:

- shared REST client logic;
- profile filtering;
- stdio/stdout cleanliness;
- Streamable HTTP auth and profile routing;
- installed tarball behavior after packaging.

## Docker Compatibility Matrix

Use this when you want real upstream behavior without touching your persistent MCPHub:

```bash
RUN_MCPHUB_COMPAT_TESTS=1 pnpm test:compatibility
```

This spins up real `samanhappy/mcphub` images through `testcontainers` and verifies the shared auth path and MCP transport behavior.

## Live Read-Only Tests

These suites are opt-in. They do not run unless you explicitly enable them.

Minimal setup:

```bash
export RUN_REAL_MCPHUB_TESTS=1
export REAL_TEST_MCPHUB_URL="https://mcphub-test.example.com"
export REAL_TEST_MCPHUB_TOKEN="REPLACE_ME"
export REAL_TEST_HTTP_AUTH_TOKEN="REPLACE_ME_LOCAL_HTTP_TOKEN"
pnpm test:real:readonly
```

What this does:

- `doctor --json` against the real MCPHub;
- `stdio` handshake and safe tool listing;
- local HTTP transport with a local bearer token;
- safe MCP tool calls against the real upstream.

Important:

- `REAL_TEST_HTTP_AUTH_TOKEN` is local to this MCP package.
- It is not an upstream MCPHub management token.
- The upstream management credential is still `REAL_TEST_MCPHUB_TOKEN`.

## Controlled Mutation Tests

Mutation tests are intentionally separated from read-only tests.

Enable them only against a dedicated test MCPHub:

```bash
export RUN_REAL_MCPHUB_MUTATION_TESTS=1
export REAL_TEST_MCPHUB_URL="https://mcphub-test.example.com"
export REAL_TEST_MCPHUB_TOKEN="REPLACE_ME"
export REAL_TEST_FIXTURE_PREFIX="mcp-mcphub-test"
pnpm test:real:mutation
```

Current mutation scope:

- create one namespaced group;
- verify it appears;
- delete it again;
- clean up leftovers if the test fails.

Never point this suite at production.

## Cleanup

If a mutation run is interrupted, remove leftover fixtures with:

```bash
pnpm cleanup:real-fixtures
```

The cleanup script currently removes groups whose names start with `REAL_TEST_FIXTURE_PREFIX`.

## Real-Test Variables

These variables are only for the test harness and release validation. They are not runtime server variables.

| Variable | Required | Purpose |
| --- | --- | --- |
| `RUN_REAL_MCPHUB_TESTS` | yes for live read-only suites | opt-in switch for live read-only tests |
| `RUN_REAL_MCPHUB_MUTATION_TESTS` | yes for mutation suites | opt-in switch for live mutation tests |
| `REAL_TEST_MCPHUB_URL` | yes | dedicated MCPHub base URL used by the live test harness |
| `REAL_TEST_MCPHUB_TOKEN` | yes | upstream MCPHub management credential used by the live test harness |
| `REAL_TEST_HTTP_AUTH_TOKEN` | yes for HTTP live tests | local token used to call the temporary local HTTP MCP server started by the tests |
| `REAL_TEST_MCPHUB_AUTH_HEADER` | optional | override upstream auth header if the test MCPHub expects `x-auth-token` |
| `REAL_TEST_MCPHUB_TOKEN_KIND` | optional | override upstream auth mode, defaults to `bearer` |
| `REAL_TEST_MCPHUB_PROFILE` | optional | choose one upstream profile name for multi-profile setups |
| `REAL_TEST_FIXTURE_PREFIX` | optional | prefix used for mutation fixtures and cleanup |
| `RELEASE_REAL_TESTS_REQUIRED` | optional | if set to `1`, the release gate fails instead of skipping live suites when secrets are missing |

## Release Gate

`pnpm test:release-gate` runs the publish-grade path:

1. docs compatibility check;
2. typecheck;
3. lint;
4. deterministic tests;
5. integration tests;
6. coverage matrix verification;
7. clean build;
8. Docker compatibility tests;
9. tarball creation and audit;
10. installed package runtime verification;
11. npm publish dry-run;
12. optional live read-only checks when configured.

The `release.yml` workflow uses this gate before the `changesets` publish step.

## GitHub Actions

Relevant workflows:

- `ci.yml`: fast PR-grade validation plus installed tarball runtime verification;
- `compatibility-matrix.yml`: real Docker-based MCPHub version matrix;
- `real-behavior.yml`: scheduled or manual live MCPHub checks against dedicated secrets;
- `release.yml`: changesets release flow guarded by `pnpm test:release-gate`.
