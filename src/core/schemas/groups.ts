// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';
import {
  identifierSchema,
  listResponseSchema,
  mutationResultSchema,
  passthroughObjectSchema,
} from './common.js';

export const groupIdSchema = identifierSchema;
export const groupSchema = passthroughObjectSchema;
export const groupListSchema = listResponseSchema;
export const groupMutationResultSchema = mutationResultSchema;
export const groupServerBatchSchema = z.array(identifierSchema);
