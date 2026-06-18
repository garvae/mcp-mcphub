// SPDX-License-Identifier: Apache-2.0

import { identifierSchema, listResponseSchema, mutationResultSchema, passthroughObjectSchema } from './common.js';

export const bearerKeyIdSchema = identifierSchema;
export const bearerKeySchema = passthroughObjectSchema;
export const bearerKeyListSchema = listResponseSchema;
export const bearerKeyMutationResultSchema = mutationResultSchema;
