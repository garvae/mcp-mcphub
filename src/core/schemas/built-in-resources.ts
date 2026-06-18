// SPDX-License-Identifier: Apache-2.0

import { listResponseSchema, mutationResultSchema, passthroughObjectSchema } from './common.js';

export const builtinResourceSchema = passthroughObjectSchema;
export const builtinResourceListSchema = listResponseSchema;
export const builtinResourceMutationResultSchema = mutationResultSchema;
