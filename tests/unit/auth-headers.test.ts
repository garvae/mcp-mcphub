import { describe, expect, it, vi } from 'vitest';

import { createAuthHeadersProvider } from '../../src/core/mcphub-client/auth-headers.js';

function createJwt(expirationOffsetSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expirationOffsetSeconds }),
  ).toString('base64url');

  return `${header}.${payload}.signature`;
}

describe('createAuthHeadersProvider', () => {
  it('formats bearer tokens for Authorization header', async () => {
    const provider = createAuthHeadersProvider({
      baseUrl: 'https://mcphub-site.com',
      headerName: 'Authorization',
      token: 'secret',
      tokenKind: 'bearer',
    });

    await expect(provider.getHeaders()).resolves.toEqual({
      Authorization: 'Bearer secret',
    });
  });

  it('formats bearer tokens with Bearer prefix for custom header names', async () => {
    const provider = createAuthHeadersProvider({
      baseUrl: 'https://mcphub-site.com',
      headerName: 'x-auth-token',
      token: 'secret',
      tokenKind: 'bearer',
    });

    await expect(provider.getHeaders()).resolves.toEqual({
      'x-auth-token': 'Bearer secret',
    });
  });

  it('refreshes JWT tokens via login when missing', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ token: createJwt(3600) }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    const provider = createAuthHeadersProvider({
      baseUrl: 'https://mcphub-site.com',
      fetchImpl: fetchMock,
      headerName: 'x-auth-token',
      password: 'pass',
      tokenKind: 'jwt',
      username: 'user',
    });

    const headers = await provider.getHeaders();

    expect(headers['x-auth-token']).toMatch(/\./);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes expiring JWT tokens', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ token: createJwt(3600) }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    const provider = createAuthHeadersProvider({
      baseUrl: 'https://mcphub-site.com',
      fetchImpl: fetchMock,
      headerName: 'Authorization',
      password: 'pass',
      token: createJwt(1),
      tokenKind: 'jwt',
      username: 'user',
    });

    await provider.getHeaders();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('exchanges OAuth client credentials for an access token', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'oauth-access-token' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    const provider = createAuthHeadersProvider({
      baseUrl: 'https://mcphub-site.com',
      fetchImpl: fetchMock,
      headerName: 'Authorization',
      oauthClientId: 'client-id',
      oauthClientSecret: 'client-secret',
      oauthScope: 'read write',
      oauthTokenUrl: 'https://auth.example.com/oauth/token',
      tokenKind: 'oauth',
    });

    await expect(provider.getHeaders()).resolves.toEqual({
      Authorization: 'Bearer oauth-access-token',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('formats oauth tokens with Bearer prefix for custom header names', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'oauth-access-token' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    const provider = createAuthHeadersProvider({
      baseUrl: 'https://mcphub-site.com',
      fetchImpl: fetchMock,
      headerName: 'x-auth-token',
      oauthClientId: 'client-id',
      oauthClientSecret: 'client-secret',
      oauthTokenUrl: 'https://auth.example.com/oauth/token',
      tokenKind: 'oauth',
    });

    await expect(provider.getHeaders()).resolves.toEqual({
      'x-auth-token': 'Bearer oauth-access-token',
    });
  });

  it('formats Better Auth cookies as Cookie headers', async () => {
    const provider = createAuthHeadersProvider({
      baseUrl: 'https://mcphub-site.com',
      betterAuthCookie: 'session=abc123',
      headerName: 'Authorization',
      tokenKind: 'better-auth',
    });

    await expect(provider.getHeaders()).resolves.toEqual({
      Cookie: 'session=abc123',
    });
  });
});
