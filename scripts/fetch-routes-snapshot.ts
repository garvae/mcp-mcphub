// SPDX-License-Identifier: Apache-2.0

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseRoutesFromSource } from './parse-routes.js';

type FetchOptions = {
  outputDir: string;
  ref: string;
  versionLabel: string;
};

type SnapshotMetadata = {
  fetchedAt: string;
  files: string[];
  ref: string;
  repository: string;
  routeCount: number;
  versionLabel: string;
};

const DEFAULT_OPTIONS: FetchOptions = {
  outputDir: 'tests/fixtures/routes-snapshot/1.0.15',
  ref: 'v1.0.15',
  versionLabel: '1.0.15',
};

const REPOSITORY = 'samanhappy/mcphub';
const ROUTES_FILE = 'src/routes/index.ts';
const EXTRA_FILES = ['src/middlewares/auth.ts', 'src/config/index.ts', 'src/types/index.ts'];

function parseCliArgs(): FetchOptions {
  const options = { ...DEFAULT_OPTIONS };

  for (let index = 2; index < process.argv.length; index += 1) {
    const current = process.argv[index];
    const next = process.argv[index + 1];

    if (current === '--ref' && next !== undefined) {
      options.ref = next;
      index += 1;
      continue;
    }

    if (current === '--version-label' && next !== undefined) {
      options.versionLabel = next;
      index += 1;
      continue;
    }

    if (current === '--output-dir' && next !== undefined) {
      options.outputDir = next;
      index += 1;
      continue;
    }
  }

  return options;
}

function toRawGitHubUrl(ref: string, filePath: string): string {
  return `https://raw.githubusercontent.com/${REPOSITORY}/${ref}/${filePath}`;
}

function toTypeScriptPath(importPath: string): string {
  return importPath.replace(/\.js$/, '.ts');
}

function extractLocalImports(routeSource: string): string[] {
  const imports = [...routeSource.matchAll(/from ['"](\.\.[^'"]+)['"]/g)]
    .map((match) => match[1])
    .filter((match): match is string => match !== undefined);
  const filePaths = imports.map((importPath) => {
    return toTypeScriptPath(join('src/routes', importPath));
  });

  return [...new Set(filePaths.map((filePath) => filePath.replace(/\\/g, '/')))];
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'garvae-mcp-mcphub-snapshot-fetcher',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${String(response.status)} ${response.statusText}`);
  }

  return response.text();
}

async function writeSnapshotFile(outputDir: string, filePath: string, content: string): Promise<void> {
  const targetFile = resolve(outputDir, 'files', filePath);
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\n{2,}$/u, '\n');
  await mkdir(dirname(targetFile), { recursive: true });
  await writeFile(targetFile, normalizedContent, 'utf8');
}

async function main(): Promise<void> {
  const options = parseCliArgs();
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });

  const routeSource = await fetchText(toRawGitHubUrl(options.ref, ROUTES_FILE));
  const filesToFetch = [...new Set([ROUTES_FILE, ...extractLocalImports(routeSource), ...EXTRA_FILES])];

  for (const filePath of filesToFetch) {
    const content = filePath === ROUTES_FILE ? routeSource : await fetchText(toRawGitHubUrl(options.ref, filePath));
    await writeSnapshotFile(outputDir, filePath, content);
  }

  const routes = parseRoutesFromSource(routeSource, ROUTES_FILE);
  const metadata: SnapshotMetadata = {
    fetchedAt: new Date().toISOString(),
    files: filesToFetch.sort(),
    ref: options.ref,
    repository: REPOSITORY,
    routeCount: routes.length,
    versionLabel: options.versionLabel,
  };

  await writeFile(resolve(outputDir, 'routes.json'), `${JSON.stringify(routes, null, 2)}\n`, 'utf8');
  await writeFile(resolve(outputDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main();
}
