// SPDX-License-Identifier: Apache-2.0

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type CompatibilityConfig = {
  minimumBestEffortVersion: string;
  pinnedReleaseTargetVersion: string;
  routeSnapshotBaselineVersion: string;
  upstreamRepository: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repositoryRoot = path.resolve(__dirname, '..');
const configPath = path.join(repositoryRoot, 'config', 'upstream-compatibility.json');
const targetsPath = path.join(repositoryRoot, 'src', 'core', 'compatibility', 'targets.ts');
const upstreamDocsPath = path.join(repositoryRoot, 'docs', 'upstream-mcphub.md');
const fixturesDirectory = path.join(repositoryRoot, 'tests', 'fixtures', 'routes-snapshot');

function readConfig(): CompatibilityConfig {
  return JSON.parse(readFileSync(configPath, 'utf8')) as CompatibilityConfig;
}

function hasRouteSnapshot(version: string): boolean {
  return existsSync(path.join(fixturesDirectory, version, 'routes.json'));
}

function renderTargetsModule(config: CompatibilityConfig): string {
  const { minimumBestEffortVersion, pinnedReleaseTargetVersion, routeSnapshotBaselineVersion, upstreamRepository } = config;
  const pinnedHasRouteSnapshot = hasRouteSnapshot(pinnedReleaseTargetVersion);
  const automatedImageTags = [...new Set([routeSnapshotBaselineVersion, pinnedReleaseTargetVersion, 'latest'])];
  const pinnedNotes = pinnedHasRouteSnapshot
    ? `Pinned release target with a committed route snapshot for ${pinnedReleaseTargetVersion}.`
    : `Pinned release target refreshed by weekly automation; runtime compatibility is smoke-tested even when no dedicated route snapshot is committed yet.`;
  const compatibilityNotesSummary = pinnedHasRouteSnapshot
    ? `The \`${pinnedReleaseTargetVersion}\` route snapshot is committed alongside the current baseline.`
    : `The weekly pinned release target is \`${pinnedReleaseTargetVersion}\`; if no dedicated route snapshot is committed yet, container smoke tests still cover runtime compatibility.`;
  const escapedPinnedNotes = pinnedNotes.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const escapedCompatibilityNotesSummary = compatibilityNotesSummary.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  return `// SPDX-License-Identifier: Apache-2.0

export type CompatibilityStatus = 'best-effort' | 'smoke-tested' | 'verified';

export type UpstreamCompatibilityTarget = {
  imageTag: string;
  label: string;
  notes: string;
  routeSnapshotVersion?: string;
  status: CompatibilityStatus;
};

export const UPSTREAM_COMPATIBILITY_REPOSITORY = '${upstreamRepository}';
export const ROUTE_SNAPSHOT_BASELINE_VERSION = '${routeSnapshotBaselineVersion}';
export const PINNED_RELEASE_TARGET_VERSION = '${pinnedReleaseTargetVersion}';
export const MINIMUM_BEST_EFFORT_VERSION = '${minimumBestEffortVersion}';
export const PINNED_RELEASE_TARGET_HAS_ROUTE_SNAPSHOT = ${pinnedHasRouteSnapshot ? 'true' : 'false'};
export const AUTOMATED_COMPATIBILITY_IMAGE_TAGS = ${JSON.stringify(automatedImageTags)} as const;
export const PINNED_RELEASE_TARGET_NOTE = '${escapedPinnedNotes}';
export const COMPATIBILITY_NOTES_SUMMARY = '${escapedCompatibilityNotesSummary}';

export const UPSTREAM_COMPATIBILITY_TARGETS: readonly UpstreamCompatibilityTarget[] = [
  {
    imageTag: '${routeSnapshotBaselineVersion}',
    label: '${routeSnapshotBaselineVersion}',
    notes: 'Current pinned route snapshot and compatibility baseline.',
    routeSnapshotVersion: '${routeSnapshotBaselineVersion}',
    status: 'verified',
  },
  {
    imageTag: '${pinnedReleaseTargetVersion}',
    label: '${pinnedReleaseTargetVersion}',
    notes: PINNED_RELEASE_TARGET_NOTE,
${pinnedHasRouteSnapshot ? `    routeSnapshotVersion: '${pinnedReleaseTargetVersion}',\n` : ''}    status: 'smoke-tested',
  },
  {
    imageTag: 'latest',
    label: 'latest Docker tag',
    notes: 'Tracks the upstream latest container tag in scheduled CI.',
    status: 'smoke-tested',
  },
  {
    imageTag: '<${minimumBestEffortVersion}',
    label: '<${minimumBestEffortVersion}',
    notes: 'Not covered by the automated compatibility matrix.',
    status: 'best-effort',
  },
] as const;

export function getAutomatedCompatibilityTargets(selectedImageTag?: string): UpstreamCompatibilityTarget[] {
  const automatedTargets = UPSTREAM_COMPATIBILITY_TARGETS.filter((target) => AUTOMATED_COMPATIBILITY_IMAGE_TAGS.includes(target.imageTag as (typeof AUTOMATED_COMPATIBILITY_IMAGE_TAGS)[number]));

  if (selectedImageTag === undefined || selectedImageTag.length === 0) {
    return [...automatedTargets];
  }

  const selectedTarget = automatedTargets.find((target) => target.imageTag === selectedImageTag);
  if (selectedTarget === undefined) {
    throw new Error(\`Unknown MCPHub compatibility target "\${selectedImageTag}".\`);
  }

  return [selectedTarget];
}
`;
}

function renderUpstreamDocs(config: CompatibilityConfig): string {
  const { minimumBestEffortVersion, pinnedReleaseTargetVersion, routeSnapshotBaselineVersion, upstreamRepository } = config;

  return `# Upstream MCPHub

This package is an independent management-layer integration for MCPHub.

It is not the upstream MCPHub project and it should not be described as an official MCPHub package unless upstream maintainers explicitly adopt it later.

## Official References

- Repository: [${upstreamRepository}](https://github.com/${upstreamRepository})
- Documentation: [docs.mcphub.app](https://docs.mcphub.app/)
- API reference: [docs.mcphub.app/api-reference/introduction](https://docs.mcphub.app/api-reference/introduction)
- AI-friendly docs index: [docs.mcphub.app/llms.txt](https://docs.mcphub.app/llms.txt)

## Relationship

This project wraps MCPHub management endpoints exposed under \`/api/*\` and turns them into:

- typed \`mcphub_*\` tools
- profile-aware MCP transports
- safer defaults for redaction, confirmations, and feature-gated dangerous operations

It does not replace:

- MCPHub's own downstream \`/mcp\` runtime gateway
- MCPHub's UI
- MCPHub's official CLI and deployment tooling

## Compatibility Baseline

- Verified baseline: \`${upstreamRepository}@v${routeSnapshotBaselineVersion}\`
- Weekly pinned release target: \`${pinnedReleaseTargetVersion}\`
- Fresh upstream smoke target: \`latest\`

See [compatibility.md](./compatibility.md) for the generated matrix and [api-coverage.md](./api-coverage.md) for route-level classification.

## Route Drift Policy

- New upstream management routes should fail route-drift and coverage checks until they are classified.
- Internal-only or runtime-dynamic upstream routes may remain intentionally unexposed.
- Tool catalogs should be regenerated from the registry and coverage matrix whenever route coverage changes.

## Token Guidance

This package consumes MCPHub management credentials. For the least surprising first-run path:

- use a system-level bearer key when your MCPHub version supports it cleanly
- verify the credential with \`doctor\`
- prefer normal management endpoints such as \`GET /api/servers\` for manual bearer smoke checks

If your MCPHub deployment uses JWT, OAuth, or Better Auth, see [auth-modes.md](./auth-modes.md) and the official MCPHub docs for the exact upstream flow.

## Version Policy

- Versions below \`${minimumBestEffortVersion}\` are best-effort only.
- The weekly automation refreshes the pinned release target through a pull request instead of editing workflow YAML manually.
`;
}

function main(): void {
  const config = readConfig();
  mkdirSync(path.dirname(targetsPath), { recursive: true });
  writeFileSync(targetsPath, renderTargetsModule(config), 'utf8');
  writeFileSync(upstreamDocsPath, renderUpstreamDocs(config), 'utf8');
}

main();
