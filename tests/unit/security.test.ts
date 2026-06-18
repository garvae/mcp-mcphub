import { describe, expect, it } from 'vitest';

import {
  assertAllowedCommand,
  assertAllowedTargetHost,
  extractCandidateUrls,
} from '../../src/security/allowlist.js';
import { assertSafeDescription } from '../../src/security/description-lint.js';
import { assertNotManagementServer } from '../../src/security/self-protect.js';
import { assertNoPrivateUrl, isPrivateHost } from '../../src/security/ssrf.js';

describe('security helpers', () => {
  it('detects localhost and private network targets', () => {
    expect(isPrivateHost('localhost')).toBe(true);
    expect(isPrivateHost('127.0.0.1')).toBe(true);
    expect(isPrivateHost('10.0.0.1')).toBe(true);
    expect(isPrivateHost('172.16.0.5')).toBe(true);
    expect(isPrivateHost('169.254.10.1')).toBe(true);
    expect(isPrivateHost('192.168.1.10')).toBe(true);
    expect(isPrivateHost('::1')).toBe(true);
    expect(isPrivateHost('fd12::1')).toBe(true);
    expect(isPrivateHost('fe80::1')).toBe(true);
    expect(isPrivateHost('8.8.8.8')).toBe(false);
  });

  it('blocks private urls for SSRF-sensitive fields', () => {
    expect(() => assertNoPrivateUrl('http://127.0.0.1:3000')).toThrow();
    expect(() => assertNoPrivateUrl('ftp://example.com/archive')).toThrow(/non-HTTP/u);
    expect(() => assertNoPrivateUrl('https://example.com')).not.toThrow();
  });

  it('extracts nested candidate url fields and enforces stdio command allowlists', () => {
    expect(
      extractCandidateUrls({
        metadata: {
          apiUrl: 'https://example.com',
          nested: {
            endpoint: 'https://example.com/mcp',
          },
        },
        origins: ['https://origin-1.example', 'https://origin-2.example'],
        name: 'server',
      }),
    ).toEqual([
      'https://example.com',
      'https://example.com/mcp',
      'https://origin-1.example',
      'https://origin-2.example',
    ]);
    expect(() => assertAllowedCommand('node', false)).toThrow();
    expect(() => assertAllowedCommand('node', true)).not.toThrow();
    expect(() =>
      assertAllowedTargetHost('https://api.example.com/mcp', ['api.example.com']),
    ).not.toThrow();
    expect(() =>
      assertAllowedTargetHost('https://blocked.example.com/mcp', ['api.example.com']),
    ).toThrow();
  });

  it('rejects unsafe descriptions and self-targeting operations', () => {
    expect(() => assertSafeDescription('Normal operational description.')).not.toThrow();
    expect(() => assertSafeDescription('Bearer secret-token')).toThrow();
    expect(() => assertNotManagementServer('manager', 'manager', 'delete server')).toThrow();
    expect(() => assertNotManagementServer('server-a', 'manager', 'delete server')).not.toThrow();
  });
});
