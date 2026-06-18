// SPDX-License-Identifier: Apache-2.0

import type { Logger } from '../../observability/logger.js';
import { createAuthRefreshError } from './errors.js';
import type { AuthHeadersProvider, FetchLike } from './types.js';

type AuthHeadersProviderOptions = {
  baseUrl: string;
  betterAuthCookie?: string;
  fetchImpl?: FetchLike;
  headerName: 'Authorization' | 'x-auth-token';
  logger?: Logger;
  oauthClientId?: string;
  oauthClientSecret?: string;
  oauthScope?: string;
  oauthTokenUrl?: string;
  password?: string;
  token?: string;
  tokenKind: 'bearer' | 'better-auth' | 'jwt' | 'oauth';
  username?: string;
};

type LoginResponseShape = {
  accessToken?: string;
  data?: {
    token?: string;
  };
  jwt?: string;
  token?: string;
};

type OAuthTokenResponseShape = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
};

function normalizeBaseUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function buildAuthHeader(
  headerName: string,
  tokenKind: 'bearer' | 'better-auth' | 'jwt' | 'oauth',
  token: string,
): Record<string, string> {
  if (tokenKind === 'better-auth') {
    return {
      Cookie: token,
    };
  }

  // MCPHub parses bearer-style credentials from the configured bearer auth header,
  // and still expects the `Bearer ` prefix even when that header is not Authorization.
  if (tokenKind === 'bearer' || tokenKind === 'oauth' || headerName === 'Authorization') {
    return {
      [headerName]: `Bearer ${token}`,
    };
  }

  return {
    [headerName]: token,
  };
}

function decodeJwtExpiration(token: string): number | undefined {
  const tokenParts = token.split('.');
  const payload = tokenParts[1];

  if (payload === undefined) {
    return undefined;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number };
    return decoded.exp;
  } catch {
    return undefined;
  }
}

function isJwtExpiringSoon(token: string): boolean {
  const expiration = decodeJwtExpiration(token);
  if (expiration === undefined) {
    return false;
  }

  return expiration <= Math.floor(Date.now() / 1000) + 30;
}

function extractToken(payload: LoginResponseShape): string | undefined {
  return payload.token ?? payload.jwt ?? payload.accessToken ?? payload.data?.token;
}

export function createAuthHeadersProvider(options: AuthHeadersProviderOptions): AuthHeadersProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const logger = options.logger;
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  let currentToken = options.token;
  let refreshPromise: Promise<string> | undefined;

  const canLogin = options.tokenKind === 'jwt' && options.username !== undefined && options.password !== undefined;
  const canExchangeOAuthToken =
    options.tokenKind === 'oauth' &&
    options.oauthClientId !== undefined &&
    options.oauthClientSecret !== undefined &&
    options.oauthTokenUrl !== undefined;

  const login = async (): Promise<string> => {
    const username = options.username;
    const password = options.password;
    if (username === undefined || password === undefined) {
      throw createAuthRefreshError('Missing username/password for JWT login.');
    }

    logger?.debug('Refreshing MCPHub JWT token via login endpoint.');
    const response = await fetchImpl(`${baseUrl}/api/auth/login`, {
      body: JSON.stringify({ password, username }),
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST',
    });

    const payload = (await response.json()) as LoginResponseShape;
    const token = extractToken(payload);
    if (!response.ok || token === undefined) {
      throw createAuthRefreshError(payload);
    }

    currentToken = token;
    return token;
  };

  const exchangeOAuthToken = async (): Promise<string> => {
    const clientId = options.oauthClientId;
    const clientSecret = options.oauthClientSecret;
    const tokenUrl = options.oauthTokenUrl;

    if (clientId === undefined || clientSecret === undefined || tokenUrl === undefined) {
      throw createAuthRefreshError('Missing OAuth client credentials for MCPHub token exchange.');
    }

    logger?.debug('Refreshing MCPHub OAuth access token via client credentials.');
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      ...(options.oauthScope !== undefined ? { scope: options.oauthScope } : {}),
    });
    const response = await fetchImpl(tokenUrl, {
      body,
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
    });

    const payload = (await response.json()) as OAuthTokenResponseShape;
    const token = payload.access_token;
    if (!response.ok || token === undefined) {
      throw createAuthRefreshError(payload);
    }

    currentToken = token;
    return token;
  };

  const ensureJwtToken = async (): Promise<string> => {
    if (currentToken === undefined) {
      if (!canLogin) {
        throw createAuthRefreshError('JWT token is missing and login credentials were not provided.');
      }
    } else if (!isJwtExpiringSoon(currentToken)) {
      return currentToken;
    }

    if (refreshPromise === undefined) {
      refreshPromise = login().finally(() => {
        refreshPromise = undefined;
      });
    }

    return refreshPromise;
  };

  const ensureOAuthToken = async (): Promise<string> => {
    if (currentToken !== undefined) {
      return currentToken;
    }

    if (!canExchangeOAuthToken) {
      throw createAuthRefreshError('OAuth token is missing and client credentials were not provided.');
    }

    if (refreshPromise === undefined) {
      refreshPromise = exchangeOAuthToken().finally(() => {
        refreshPromise = undefined;
      });
    }

    return refreshPromise;
  };

  return {
    canRetryAuth(): boolean {
      return canLogin || canExchangeOAuthToken;
    },
    async getHeaders(): Promise<Record<string, string>> {
      if (options.tokenKind === 'bearer') {
        if (currentToken === undefined) {
          throw createAuthRefreshError('Bearer token is missing.');
        }

        return buildAuthHeader(options.headerName, options.tokenKind, currentToken);
      }

      if (options.tokenKind === 'better-auth') {
        if (options.betterAuthCookie === undefined) {
          throw createAuthRefreshError('Better Auth cookie is missing.');
        }

        return buildAuthHeader(options.headerName, options.tokenKind, options.betterAuthCookie);
      }

      if (options.tokenKind === 'oauth') {
        const oauthToken = await ensureOAuthToken();
        return buildAuthHeader(options.headerName, options.tokenKind, oauthToken);
      }

      const jwtToken = await ensureJwtToken();
      return buildAuthHeader(options.headerName, options.tokenKind, jwtToken);
    },
    invalidate(): void {
      if (options.tokenKind === 'jwt' || options.tokenKind === 'oauth') {
        currentToken = undefined;
      }
    },
  };
}
