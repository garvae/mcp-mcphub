// SPDX-License-Identifier: Apache-2.0

import { mutationResultSchema, nonEmptyStringSchema, passthroughObjectSchema } from './common.js';

export const serverResourceUriSchema = nonEmptyStringSchema;
export const serverResourceSchema = passthroughObjectSchema;
export const serverResourceMutationResultSchema = mutationResultSchema;
