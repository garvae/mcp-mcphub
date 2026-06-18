// SPDX-License-Identifier: Apache-2.0

import { classifyRoute } from './classify.js';
import { COVERAGEABLE_ROUTES } from './routes-snapshot.js';
import type { CoverageEntry } from './types.js';

export const COVERAGE: CoverageEntry[] = COVERAGEABLE_ROUTES.map((route) => classifyRoute(route));
