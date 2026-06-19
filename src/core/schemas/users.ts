// SPDX-License-Identifier: Apache-2.0

import {
  identifierSchema,
  listResponseSchema,
  mutationResultSchema,
  passthroughObjectSchema,
} from './common.js';

export const usernameSchema = identifierSchema;
export const userSchema = passthroughObjectSchema;
export const userListSchema = listResponseSchema;
export const userStatsSchema = passthroughObjectSchema;
export const userMutationResultSchema = mutationResultSchema;
