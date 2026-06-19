// SPDX-License-Identifier: Apache-2.0

import { REDACTED_PLACEHOLDER } from '../../config/defaults.js';
import { REDACTED_KEYS, REDACTION_PATTERNS } from './patterns.js';

type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike };

export type RedactorOptions = {
  allowlistedKeys?: readonly string[];
  placeholder?: string;
};

function shouldRedactKey(key: string, allowlistedKeys: readonly string[]): boolean {
  if (allowlistedKeys.includes(key)) {
    return false;
  }

  return REDACTED_KEYS.some((candidate) => candidate.toLowerCase() === key.toLowerCase());
}

function redactString(value: string, placeholder: string): string {
  return REDACTION_PATTERNS.reduce(
    (current, pattern) => current.replaceAll(pattern, placeholder),
    value,
  );
}

function redactJsonLike(value: JsonLike, options: Required<RedactorOptions>): JsonLike {
  if (typeof value === 'string') {
    return redactString(value, options.placeholder);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactJsonLike(item, options));
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, itemValue]) => {
        if (shouldRedactKey(key, options.allowlistedKeys)) {
          return [key, options.placeholder];
        }

        return [key, redactJsonLike(itemValue, options)];
      }),
    );
  }

  return value;
}

export function createRedactor(options: RedactorOptions = {}) {
  const normalizedOptions: Required<RedactorOptions> = {
    allowlistedKeys: options.allowlistedKeys ?? [],
    placeholder: options.placeholder ?? REDACTED_PLACEHOLDER,
  };

  return {
    redactString(value: string): string {
      return redactString(value, normalizedOptions.placeholder);
    },
    redactValue<T>(value: T): T {
      if (typeof value === 'string') {
        return this.redactString(value) as T;
      }

      return redactJsonLike(value as JsonLike, normalizedOptions) as T;
    },
  };
}
