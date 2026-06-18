// SPDX-License-Identifier: Apache-2.0

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { verifyCoverageRoutes } from '../src/core/coverage/verify.js';
import type { SnapshotRoute } from '../src/core/coverage/types.js';

function parseCliArgs(): string {
  const routesFlagIndex = process.argv.indexOf('--routes');
  const next = routesFlagIndex === -1 ? undefined : process.argv[routesFlagIndex + 1];
  if (next !== undefined) {
    return next;
  }

  return 'tests/fixtures/routes-snapshot/1.0.15/routes.json';
}

async function main(): Promise<void> {
  const routesFile = resolve(parseCliArgs());
  const routes = JSON.parse(await readFile(routesFile, 'utf8')) as SnapshotRoute[];
  const result = verifyCoverageRoutes(routes);
  const problems = [
    ...result.missingCoverageKeys.map((key) => `Missing coverage entry: ${key}`),
    ...result.extraCoverageKeys.map((key) => `Coverage entry not present in snapshot: ${key}`),
    ...result.duplicateCoverageKeys.map((key) => `Duplicate coverage entry: ${key}`),
  ];

  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(problem);
    }

    process.exitCode = 1;
    return;
  }

  process.stdout.write(`Coverage verification passed for ${routesFile}\n`);
}

void main();
