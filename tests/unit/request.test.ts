import { describe, expect, it, vi } from 'vitest';

import { McpHubApiError } from '../../src/core/mcphub-client/errors.js';
import { createRequestClient } from '../../src/core/mcphub-client/request.js';

describe('createRequestClient', () => {
  it('retries idempotent requests on server error', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'retry me' }), {
          headers: { 'content-type': 'application/json' },
          status: 500,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          headers: { 'content-type': 'application/json' },
          status: 200,
        }),
      );

    const client = createRequestClient({
      authProvider: {
        canRetryAuth: () => false,
        getHeaders: () => Promise.resolve({ Authorization: 'Bearer x' }),
        invalidate: () => undefined,
      },
      baseUrl: 'https://mcphub-site.com',
      fetchImpl: fetchMock,
      retryAttempts: 1,
      retryBackoffMs: 0,
      timeoutMs: 1000,
    });

    await expect(client.json({ method: 'GET', path: '/api/settings' })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('invalidates auth once on unauthorized response', async () => {
    const invalidate = vi.fn();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'unauthorized' }), {
          headers: { 'content-type': 'application/json' },
          status: 401,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          headers: { 'content-type': 'application/json' },
          status: 200,
        }),
      );

    const client = createRequestClient({
      authProvider: {
        canRetryAuth: () => true,
        getHeaders: () => Promise.resolve({ Authorization: 'Bearer x' }),
        invalidate,
      },
      baseUrl: 'https://mcphub-site.com',
      fetchImpl: fetchMock,
      retryAttempts: 0,
      retryBackoffMs: 0,
      timeoutMs: 1000,
    });

    await expect(client.json({ method: 'GET', path: '/api/settings' })).resolves.toEqual({ ok: true });
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('throws normalized API errors', async () => {
    const client = createRequestClient({
      authProvider: {
        canRetryAuth: () => false,
        getHeaders: () => Promise.resolve({ Authorization: 'Bearer x' }),
        invalidate: () => undefined,
      },
      baseUrl: 'https://mcphub-site.com',
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ message: 'nope' }), {
          headers: { 'content-type': 'application/json' },
          status: 404,
        }),
      ),
      retryAttempts: 0,
      retryBackoffMs: 0,
      timeoutMs: 1000,
    });

    await expect(client.json({ method: 'GET', path: '/api/missing' })).rejects.toMatchObject({
      code: 'not_found',
      status: 404,
    } satisfies Partial<McpHubApiError>);
  });
});
