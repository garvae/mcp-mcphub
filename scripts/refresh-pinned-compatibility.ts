// SPDX-License-Identifier: Apache-2.0

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type CompatibilityConfig = {
  minimumBestEffortVersion: string;
  pinnedReleaseTargetVersion: string;
  routeSnapshotBaselineVersion: string;
  upstreamRepository: string;
};

type GithubRelease = {
  draft: boolean;
  prerelease: boolean;
  tag_name: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repositoryRoot = path.resolve(__dirname, '..');
const configPath = path.join(repositoryRoot, 'config', 'upstream-compatibility.json');

function readConfig(): CompatibilityConfig {
  return JSON.parse(readFileSync(configPath, 'utf8')) as CompatibilityConfig;
}

function normalizeTag(tagName: string): string {
  return tagName.replace(/^v/i, '');
}

function isStableSemver(tagName: string): boolean {
  return /^v?\d+\.\d+\.\d+$/.test(tagName);
}

async function resolveLatestStableRelease(repository: string): Promise<string> {
  const response = await fetch(`https://api.github.com/repos/${repository}/releases?per_page=20`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'mcp-mcphub-compatibility-refresh',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub releases for ${repository}: HTTP ${String(response.status)}`);
  }

  const releases = (await response.json()) as GithubRelease[];
  const stableRelease = releases.find((release) => !release.draft && !release.prerelease && isStableSemver(release.tag_name));

  if (stableRelease === undefined) {
    throw new Error(`No stable GitHub release tags found for ${repository}.`);
  }

  return normalizeTag(stableRelease.tag_name);
}

async function main(): Promise<void> {
  const config = readConfig();
  const latestStableRelease = await resolveLatestStableRelease(config.upstreamRepository);

  if (latestStableRelease === config.pinnedReleaseTargetVersion) {
    process.stdout.write(`Pinned compatibility target already up to date at ${latestStableRelease}.\n`);
    return;
  }

  const nextConfig: CompatibilityConfig = {
    ...config,
    pinnedReleaseTargetVersion: latestStableRelease,
  };

  writeFileSync(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8');
  process.stdout.write(`Updated pinned compatibility target from ${config.pinnedReleaseTargetVersion} to ${latestStableRelease}.\n`);
}

await main();
