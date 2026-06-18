import { describe, expect, it } from 'vitest';

import { createRedactor } from '../../src/core/redaction/redactor.js';

describe('createRedactor', () => {
  it('redacts sensitive keys recursively', () => {
    const redactor = createRedactor();

    expect(
      redactor.redactValue({
        headers: {
          Authorization: 'Bearer top-secret',
        },
        nested: {
          token: 'abc',
        },
      }),
    ).toEqual({
      headers: '[REDACTED]',
      nested: {
        token: '[REDACTED]',
      },
    });
  });

  it('redacts bearer and jwt-like strings inside text', () => {
    const redactor = createRedactor();

    expect(redactor.redactString('Authorization: Bearer token-value')).toContain('[REDACTED]');
    expect(redactor.redactString('eyJhbGciOiJIUzI1NiJ9.abc.def')).toBe('[REDACTED]');
  });
});
