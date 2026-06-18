// SPDX-License-Identifier: Apache-2.0

import { listResponseSchema, mutationResultSchema, passthroughObjectSchema } from './common.js';

export const logEntrySchema = passthroughObjectSchema;
export const logListSchema = listResponseSchema;
export const logClearResultSchema = mutationResultSchema;
