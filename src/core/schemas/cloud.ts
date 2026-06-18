// SPDX-License-Identifier: Apache-2.0

import { listResponseSchema, mutationResultSchema, passthroughObjectSchema } from './common.js';

export const cloudServerSchema = passthroughObjectSchema;
export const cloudServerListSchema = listResponseSchema;
export const cloudToolListSchema = listResponseSchema;
export const cloudToolCallResultSchema = mutationResultSchema;
