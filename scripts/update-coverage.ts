// SPDX-License-Identifier: Apache-2.0

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { format } from 'prettier';

import { COVERAGE } from '../src/core/coverage/matrix.js';
import {
  DYNAMIC_ROUTES,
  SNAPSHOT_REPOSITORY,
  SNAPSHOT_VERSION,
} from '../src/core/coverage/routes-snapshot.js';
import { routeKey } from '../src/core/coverage/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repositoryRoot = path.resolve(__dirname, '..');
const docsDirectory = path.join(repositoryRoot, 'docs');
const generatedDirectory = path.join(docsDirectory, 'generated');
const markdownOutputPath = path.join(docsDirectory, 'api-coverage.md');
const jsonOutputPath = path.join(generatedDirectory, 'api-coverage.json');

function renderMarkdown(): string {
  const header = [
    '# API Coverage',
    '',
    `Generated from upstream snapshot \`${SNAPSHOT_REPOSITORY}@v${SNAPSHOT_VERSION}\`.`,
    '',
    'This matrix classifies every coverageable route from `src/routes/index.ts`.',
    '',
    '## Legend',
    '',
    '- `Classification`: exposure or handling category used by the management MCP.',
    '- `Profile`: highest exposure profile required to expose the route as an MCP capability.',
    '- `Risk`: operational risk class used for confirmations and redaction policy.',
    '',
    '## Classified Routes',
    '',
    '| Route | Authenticated | Classification | Profile | Risk | MCP Surface | Notes |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];

  const rows = COVERAGE.map((entry) => {
    const surface =
      entry.mcp.kind === 'none' || entry.mcp.name === null
        ? entry.mcp.kind
        : `${entry.mcp.kind}: \`${entry.mcp.name}\``;

    return `| \`${routeKey(entry)}\` | ${entry.authenticated ? 'yes' : 'no'} | \`${entry.classification}\` | ${entry.profile === null ? '-' : `\`${entry.profile}\``} | ${entry.risk === null ? '-' : `\`${entry.risk}\``} | ${surface} | ${entry.notes} |`;
  });

  const dynamicSection = [
    '',
    '## Dynamic Routes Excluded From Coverage',
    '',
    'These routes are runtime-dynamic and intentionally excluded from the strict coverage gate:',
    '',
    '| Route | Raw Path | Handler | Reason |',
    '| --- | --- | --- | --- |',
    ...DYNAMIC_ROUTES.map((route) => {
      return `| \`${route.method} ${route.fullPath}\` | \`${route.rawPath}\` | \`${route.handlerName}\` | Better Auth mounts depend on runtime-configured base paths and are treated as internal. |`;
    }),
  ];

  return [...header, ...rows, ...dynamicSection, ''].join('\n');
}

function renderJson(): string {
  return `${JSON.stringify(
    {
      dynamicRoutes: DYNAMIC_ROUTES,
      generatedFrom: {
        repository: SNAPSHOT_REPOSITORY,
        version: SNAPSHOT_VERSION,
      },
      routes: COVERAGE,
    },
    null,
    2,
  )}\n`;
}

async function writeOrCheck(filePath: string, contents: string, checkMode: boolean): Promise<void> {
  const formattedContents = await format(contents, { filepath: filePath });

  try {
    const current = readFileSync(filePath, 'utf8');
    if (current !== formattedContents) {
      throw new Error(`${path.relative(repositoryRoot, filePath)} is out of date.`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      if (checkMode) {
        throw new Error(`${path.relative(repositoryRoot, filePath)} is missing.`);
      }
    } else if (checkMode) {
      throw error;
    }
  }

  if (!checkMode) {
    writeFileSync(filePath, formattedContents, 'utf8');
  }
}

async function main(): Promise<void> {
  const checkMode = process.argv.includes('--check');
  mkdirSync(docsDirectory, { recursive: true });
  mkdirSync(generatedDirectory, { recursive: true });

  await writeOrCheck(markdownOutputPath, renderMarkdown(), checkMode);
  await writeOrCheck(jsonOutputPath, renderJson(), checkMode);
}

await main();
