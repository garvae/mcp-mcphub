// SPDX-License-Identifier: Apache-2.0

import { listResponseSchema, passthroughObjectSchema } from './common.js';

export const discoveryCategoryListSchema = listResponseSchema;
export const discoveryServerSchema = passthroughObjectSchema;
export const discoveryServerInstallSchema = passthroughObjectSchema;
export const discoveryServerListSchema = listResponseSchema;
export const discoveryTagListSchema = listResponseSchema;
