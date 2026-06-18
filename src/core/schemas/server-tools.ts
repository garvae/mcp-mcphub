// SPDX-License-Identifier: Apache-2.0

import { identifierSchema, mutationResultSchema, passthroughObjectSchema } from './common.js';

export const serverToolNameSchema = identifierSchema;
export const serverToolSchema = passthroughObjectSchema;
export const serverToolMutationResultSchema = mutationResultSchema;
