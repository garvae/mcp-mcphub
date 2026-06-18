// SPDX-License-Identifier: Apache-2.0

import { listResponseSchema, mutationResultSchema, passthroughObjectSchema } from './common.js';

export const builtinPromptSchema = passthroughObjectSchema;
export const builtinPromptListSchema = listResponseSchema;
export const builtinPromptMutationResultSchema = mutationResultSchema;
