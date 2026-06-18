// SPDX-License-Identifier: Apache-2.0

import { COVERAGE } from './matrix.js';
import { COVERAGEABLE_ROUTES } from './routes-snapshot.js';
import type { CoverageEntry, SnapshotRoute } from './types.js';
import { routeKey } from './types.js';

export type CoverageVerificationResult = {
  duplicateCoverageKeys: string[];
  extraCoverageKeys: string[];
  missingCoverageKeys: string[];
};

function getKnownCoverageKeys(): Set<string> {
  return new Set(COVERAGEABLE_ROUTES.map((route) => routeKey(route)));
}

function getCoverageKeys(entries: readonly CoverageEntry[]): string[] {
  return entries.map((entry) => routeKey(entry));
}

export function verifyCoverageRoutes(routes: readonly SnapshotRoute[]): CoverageVerificationResult {
  const coverageRoutes = routes.filter((route) => route.includeInCoverage);
  const knownRouteKeys = getKnownCoverageKeys();
  const currentCoverageKeys = getCoverageKeys(COVERAGE);
  const currentCoverageKeySet = new Set(currentCoverageKeys);

  const duplicateCoverageKeys = currentCoverageKeys.filter((key, index) => {
    return currentCoverageKeys.indexOf(key) !== index;
  });

  const missingCoverageKeys = coverageRoutes
    .map((route) => routeKey(route))
    .filter((key) => !currentCoverageKeySet.has(key));

  const extraCoverageKeys = currentCoverageKeys.filter((key) => !knownRouteKeys.has(key));

  return {
    duplicateCoverageKeys: [...new Set(duplicateCoverageKeys)],
    extraCoverageKeys: [...new Set(extraCoverageKeys)],
    missingCoverageKeys: [...new Set(missingCoverageKeys)],
  };
}
