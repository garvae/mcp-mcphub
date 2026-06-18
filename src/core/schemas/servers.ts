// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';
import { identifierSchema, listResponseSchema, mutationResultSchema, passthroughObjectSchema } from './common.js';

export const serverNameSchema = identifierSchema;
export const serverConfigSchema = passthroughObjectSchema;
export const serverListSchema = listResponseSchema;
export const batchCreateServersSchema = z.array(serverConfigSchema);
export const serverMutationResultSchema = mutationResultSchema;
