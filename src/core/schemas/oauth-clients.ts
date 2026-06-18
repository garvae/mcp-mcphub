// SPDX-License-Identifier: Apache-2.0

import { identifierSchema, listResponseSchema, mutationResultSchema, passthroughObjectSchema } from './common.js';

export const oauthClientIdSchema = identifierSchema;
export const oauthClientSchema = passthroughObjectSchema;
export const oauthClientListSchema = listResponseSchema;
export const oauthClientMutationResultSchema = mutationResultSchema;
