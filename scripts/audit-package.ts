// SPDX-License-Identifier: Apache-2.0

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

type PackageMetadata = {
  name: string;
};

const REQUIRED_ARCHIVE_ENTRIES = [
  'package/package.json',
  'package/README.md',
  'package/LICENSE',
  'package/CHANGELOG.md',
  'package/.env.example',
  'package/AGENTS.md',
  'package/docker-compose.example.yml',
  'package/CONTRIBUTING.md',
  'package/SECURITY.md',
  'package/SUPPORT.md',
  'package/dist/index.js',
  'package/dist/index.d.ts',
  'package/dist/cli/bin.js',
  'package/docs/README.md',
  'package/docs/generated/README.md',
  'package/docs/generated/api-coverage.json',
  'package/docs/generated/tools.safe.json',
] as const;

const FORBIDDEN_ARCHIVE_PREFIXES = [
  'package/src/',
  'package/tests/',
  'package/.github/',
  'package/coverage/',
] as const;
const FORBIDDEN_ARCHIVE_SUFFIXES = ['.env', '.pem', '.key'] as const;

function getArtifactsDirectory(): string {
  const artifactsDirectoryFlagIndex = process.argv.indexOf('--artifacts-dir');
  if (artifactsDirectoryFlagIndex !== -1) {
    const artifactsDirectory = process.argv.at(artifactsDirectoryFlagIndex + 1);
    if (artifactsDirectory === undefined) {
      throw new Error('--artifacts-dir requires a directory path.');
    }

    return path.resolve(artifactsDirectory);
  }

  return path.resolve(process.env.PACK_ARTIFACTS_DIR ?? '.artifacts');
}

function getExpectedTarballPrefix(packageName: string): string {
  return packageName.replace(/^@/u, '').replace(/\//gu, '-');
}

function getLatestPackageArchive(artifactsDirectory: string, expectedPrefix: string): string {
  const archives = readdirSync(artifactsDirectory)
    .filter((entry) => entry.startsWith(expectedPrefix) && entry.endsWith('.tgz'))
    .sort((left, right) => left.localeCompare(right));

  const archiveName = archives.at(-1);
  if (archiveName === undefined) {
    throw new Error(
      `No package archive matching "${expectedPrefix}*.tgz" was found in ${artifactsDirectory}.`,
    );
  }

  return path.join(artifactsDirectory, archiveName);
}

function readArchiveEntries(archivePath: string): string[] {
  const output = execFileSync('tar', ['-tf', archivePath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return output
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function assertRequiredEntries(entries: readonly string[]): void {
  for (const requiredEntry of REQUIRED_ARCHIVE_ENTRIES) {
    if (!entries.includes(requiredEntry)) {
      throw new Error(`Required package entry is missing from tarball: ${requiredEntry}`);
    }
  }
}

function assertForbiddenEntries(entries: readonly string[]): void {
  for (const entry of entries) {
    if (FORBIDDEN_ARCHIVE_PREFIXES.some((prefix) => entry.startsWith(prefix))) {
      throw new Error(`Forbidden package entry found in tarball: ${entry}`);
    }

    if (FORBIDDEN_ARCHIVE_SUFFIXES.some((suffix) => entry.endsWith(suffix))) {
      throw new Error(`Sensitive-looking entry found in tarball: ${entry}`);
    }
  }
}

function runPackCommand(artifactsDirectory: string): void {
  const npmExecPath = process.env.npm_execpath;

  if (npmExecPath !== undefined) {
    execFileSync(
      process.execPath,
      [npmExecPath, 'pack', '--pack-destination', artifactsDirectory],
      {
        stdio: 'inherit',
      },
    );
    return;
  }

  const fallbackCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  execFileSync(fallbackCommand, ['pack', '--pack-destination', artifactsDirectory], {
    stdio: 'inherit',
  });
}

function createPackageArchive(artifactsDirectory: string): void {
  rmSync(artifactsDirectory, { force: true, recursive: true });
  mkdirSync(artifactsDirectory, { recursive: true });
  runPackCommand(artifactsDirectory);
}

function main(): void {
  const packageJsonPath = path.resolve('package.json');
  const packageMetadata = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageMetadata;
  const artifactsDirectory = getArtifactsDirectory();

  if (process.argv.includes('--pack')) {
    createPackageArchive(artifactsDirectory);
  }

  const archivePath = getLatestPackageArchive(
    artifactsDirectory,
    getExpectedTarballPrefix(packageMetadata.name),
  );
  const entries = readArchiveEntries(archivePath);

  assertRequiredEntries(entries);
  assertForbiddenEntries(entries);

  process.stdout.write(
    `Package audit passed for ${path.basename(archivePath)} with ${String(entries.length)} entries.\n`,
  );
}

main();
