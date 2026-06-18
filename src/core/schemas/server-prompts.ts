// SPDX-License-Identifier: Apache-2.0

import { identifierSchema, mutationResultSchema, passthroughObjectSchema } from './common.js';

export const serverPromptNameSchema = identifierSchema;
export const serverPromptSchema = passthroughObjectSchema;
export const serverPromptMutationResultSchema = mutationResultSchema;
