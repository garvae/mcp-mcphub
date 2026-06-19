// SPDX-License-Identifier: Apache-2.0

import type { AppConfig } from '../../config/env.js';
import { resolveProfileByName } from '../../config/profiles.js';
import type { Logger } from '../../observability/logger.js';
import { createAuthHeadersProvider } from './auth-headers.js';
import { createMcpHubClient } from './client.js';

export function createConfiguredMcpHubClient(
  config: AppConfig,
  logger: Logger,
  profileName?: string,
) {
  const selectedProfile = resolveProfileByName(config.mcpHub, profileName);

  return createMcpHubClient({
    authProvider: createAuthHeadersProvider({
      baseUrl: selectedProfile.url,
      ...(selectedProfile.betterAuthCookie !== undefined
        ? { betterAuthCookie: selectedProfile.betterAuthCookie }
        : {}),
      headerName: selectedProfile.authHeader,
      logger,
      ...(selectedProfile.oauthClientId !== undefined
        ? { oauthClientId: selectedProfile.oauthClientId }
        : {}),
      ...(selectedProfile.oauthClientSecret !== undefined
        ? { oauthClientSecret: selectedProfile.oauthClientSecret }
        : {}),
      ...(selectedProfile.oauthScope !== undefined
        ? { oauthScope: selectedProfile.oauthScope }
        : {}),
      ...(selectedProfile.oauthTokenUrl !== undefined
        ? { oauthTokenUrl: selectedProfile.oauthTokenUrl }
        : {}),
      ...(selectedProfile.password !== undefined ? { password: selectedProfile.password } : {}),
      ...(selectedProfile.token !== undefined ? { token: selectedProfile.token } : {}),
      ...(selectedProfile.username !== undefined ? { username: selectedProfile.username } : {}),
      tokenKind: selectedProfile.tokenKind,
    }),
    baseUrl: selectedProfile.url,
    logger,
    retryAttempts: config.request.retryAttempts,
    retryBackoffMs: config.request.retryBackoffMs,
    timeoutMs: config.request.timeoutMs,
  });
}
