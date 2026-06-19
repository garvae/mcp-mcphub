// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';

type JsonValue = boolean | null | number | string | JsonValue[] | { [key: string]: JsonValue };

export const nonEmptyStringSchema = z.string().min(1);
export const optionalStringSchema = z.string().optional();
export const identifierSchema = nonEmptyStringSchema;
export const urlStringSchema = z.url();

export const unknownJsonSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(unknownJsonSchema),
    z.record(z.string(), unknownJsonSchema),
  ]),
);

export const passthroughObjectSchema = z.looseObject({});
export const redactedRecordSchema = z.record(z.string(), unknownJsonSchema);
export const listResponseSchema = z.array(passthroughObjectSchema);
export const mutationResultSchema = passthroughObjectSchema;
export const paginatedResponseSchema = passthroughObjectSchema;
