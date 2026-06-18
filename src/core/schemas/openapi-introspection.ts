// SPDX-License-Identifier: Apache-2.0

import { listResponseSchema, passthroughObjectSchema } from './common.js';

export const downstreamOpenApiSchema = passthroughObjectSchema;
export const downstreamOpenApiServerListSchema = listResponseSchema;
export const downstreamOpenApiStatsSchema = passthroughObjectSchema;
