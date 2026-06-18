// SPDX-License-Identifier: Apache-2.0

import { listResponseSchema, passthroughObjectSchema } from './common.js';

export const registryServerSchema = passthroughObjectSchema;
export const registryServerListSchema = listResponseSchema;
export const registryVersionSchema = passthroughObjectSchema;
