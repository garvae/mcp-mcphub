// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SnapshotRoute } from './types.js';

export const SNAPSHOT_VERSION = '1.0.15';
export const SNAPSHOT_REPOSITORY = 'samanhappy/mcphub';

const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url));

function loadSnapshotRoutes(): SnapshotRoute[] {
  const candidatePaths = [
    resolve(MODULE_DIRECTORY, '../../fixtures/routes-snapshot', SNAPSHOT_VERSION, 'routes.json'),
    resolve(MODULE_DIRECTORY, '../../../tests/fixtures/routes-snapshot', SNAPSHOT_VERSION, 'routes.json'),
  ];

  for (const snapshotFile of candidatePaths) {
    try {
      return JSON.parse(readFileSync(snapshotFile, 'utf8')) as SnapshotRoute[];
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  throw new Error(`Could not locate routes snapshot ${SNAPSHOT_VERSION} in runtime fixtures or test fixtures.`);
}

export const ROUTES_SNAPSHOT = loadSnapshotRoutes();
export const COVERAGEABLE_ROUTES = ROUTES_SNAPSHOT.filter((route) => route.includeInCoverage);
export const DYNAMIC_ROUTES = ROUTES_SNAPSHOT.filter((route) => !route.includeInCoverage);
