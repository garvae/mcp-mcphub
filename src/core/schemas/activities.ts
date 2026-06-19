// SPDX-License-Identifier: Apache-2.0

import {
  mutationResultSchema,
  paginatedResponseSchema,
  passthroughObjectSchema,
} from './common.js';

export const activitySchema = passthroughObjectSchema;
export const activityListSchema = paginatedResponseSchema;
export const activityStatsSchema = passthroughObjectSchema;
export const activityFiltersSchema = passthroughObjectSchema;
export const activityCleanupResultSchema = mutationResultSchema;
