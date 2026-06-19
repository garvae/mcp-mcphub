// SPDX-License-Identifier: Apache-2.0

export const REDACTED_KEYS = [
  'authorization',
  'x-auth-token',
  'accessToken',
  'apiKey',
  'clientSecret',
  'cookie',
  'dbUrl',
  'env',
  'environment',
  'headers',
  'jwt',
  'openaiApiKey',
  'password',
  'privateKey',
  'secret',
  'token',
] as const;

export const REDACTION_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/giu,
  /\beyJ[A-Za-z0-9_-]+?\.[A-Za-z0-9_-]+?\.[A-Za-z0-9_-]+/gu,
  /\bsk-[A-Za-z0-9]{20,}\b/gu,
];
