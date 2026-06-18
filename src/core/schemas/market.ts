// SPDX-License-Identifier: Apache-2.0

import { listResponseSchema, passthroughObjectSchema } from './common.js';

export const marketServerSchema = passthroughObjectSchema;
export const marketServerListSchema = listResponseSchema;
export const marketCategoryListSchema = listResponseSchema;
export const marketTagListSchema = listResponseSchema;
