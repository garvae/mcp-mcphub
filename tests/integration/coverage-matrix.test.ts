import { describe, expect, it } from 'vitest';

import { ROUTES_SNAPSHOT } from '../../src/core/coverage/routes-snapshot.js';
import { verifyCoverageRoutes } from '../../src/core/coverage/verify.js';

describe('coverage matrix', () => {
  it('covers every snapshot route that is marked coverageable', () => {
    expect(verifyCoverageRoutes(ROUTES_SNAPSHOT)).toEqual({
      duplicateCoverageKeys: [],
      extraCoverageKeys: [],
      missingCoverageKeys: [],
    });
  });
});
