// SPDX-License-Identifier: Apache-2.0

import { mutationResultSchema, passthroughObjectSchema } from './common.js';

export const authUserSchema = passthroughObjectSchema;
export const authLoginResultSchema = mutationResultSchema;
