// SPDX-License-Identifier: Apache-2.0

import { mcpHubProfileSchema, type McpHubProfileInput, type RawEnv } from './schema.js';

export type McpHubProfile = {
  authHeader: 'Authorization' | 'x-auth-token';
  betterAuthCookie?: string | undefined;
  oauthClientId?: string | undefined;
  oauthClientSecret?: string | undefined;
  oauthScope?: string | undefined;
  oauthTokenUrl?: string | undefined;
  password?: string | undefined;
  token?: string | undefined;
  tokenKind: 'bearer' | 'better-auth' | 'jwt' | 'oauth';
  url: string;
  username?: string | undefined;
};

export type ResolvedProfiles = {
  defaultProfile: string;
  profiles: Record<string, McpHubProfile>;
};

function resolveSecretValue(
  directValue: string | undefined,
  envKey: string | undefined,
  env: NodeJS.ProcessEnv,
): string | undefined {
  if (directValue !== undefined) {
    return directValue;
  }

  if (envKey === undefined) {
    return undefined;
  }

  return env[envKey];
}

function resolveProfile(input: McpHubProfileInput, env: NodeJS.ProcessEnv): McpHubProfile {
  const betterAuthCookie = resolveSecretValue(input.betterAuthCookie, input.betterAuthCookieEnv, env);
  const oauthClientId = resolveSecretValue(input.oauthClientId, input.oauthClientIdEnv, env);
  const oauthClientSecret = resolveSecretValue(input.oauthClientSecret, input.oauthClientSecretEnv, env);
  const oauthTokenUrl = resolveSecretValue(input.oauthTokenUrl, input.oauthTokenUrlEnv, env);
  const password = resolveSecretValue(input.password, input.passwordEnv, env);
  const token = resolveSecretValue(input.token, input.tokenEnv, env);
  const username = resolveSecretValue(input.username, input.usernameEnv, env);

  return {
    authHeader: input.authHeader,
    tokenKind: input.tokenKind,
    url: input.url,
    ...(betterAuthCookie !== undefined ? { betterAuthCookie } : {}),
    ...(oauthClientId !== undefined ? { oauthClientId } : {}),
    ...(oauthClientSecret !== undefined ? { oauthClientSecret } : {}),
    ...(input.oauthScope !== undefined ? { oauthScope: input.oauthScope } : {}),
    ...(oauthTokenUrl !== undefined ? { oauthTokenUrl } : {}),
    ...(password !== undefined ? { password } : {}),
    ...(token !== undefined ? { token } : {}),
    ...(username !== undefined ? { username } : {}),
  };
}

export function parseProfiles(rawEnv: RawEnv, env: NodeJS.ProcessEnv): ResolvedProfiles {
  if (rawEnv.MCPHUB_PROFILES_JSON !== undefined) {
    const parsedProfiles = JSON.parse(rawEnv.MCPHUB_PROFILES_JSON) as Record<string, unknown>;
    const profiles: Record<string, McpHubProfile> = {};

    for (const [name, value] of Object.entries(parsedProfiles)) {
      profiles[name] = resolveProfile(mcpHubProfileSchema.parse(value), env);
    }

    if (profiles[rawEnv.MCPHUB_DEFAULT_PROFILE] === undefined) {
      throw new Error(`Unknown MCPHUB_DEFAULT_PROFILE "${rawEnv.MCPHUB_DEFAULT_PROFILE}".`);
    }

    return {
      defaultProfile: rawEnv.MCPHUB_DEFAULT_PROFILE,
      profiles,
    };
  }

  const singleProfile = mcpHubProfileSchema.parse({
    authHeader: rawEnv.MCPHUB_AUTH_HEADER,
    betterAuthCookie: rawEnv.MCPHUB_BETTER_AUTH_COOKIE,
    oauthClientId: rawEnv.MCPHUB_OAUTH_CLIENT_ID,
    oauthClientSecret: rawEnv.MCPHUB_OAUTH_CLIENT_SECRET,
    oauthScope: rawEnv.MCPHUB_OAUTH_SCOPE,
    oauthTokenUrl: rawEnv.MCPHUB_OAUTH_TOKEN_URL,
    password: rawEnv.MCPHUB_PASSWORD,
    token: rawEnv.MCPHUB_TOKEN,
    tokenKind: rawEnv.MCPHUB_TOKEN_KIND,
    url: rawEnv.MCPHUB_URL,
    username: rawEnv.MCPHUB_USERNAME,
  });

  return {
    defaultProfile: 'default',
    profiles: {
      default: resolveProfile(singleProfile, env),
    },
  };
}

export function resolveProfileByName(
  resolvedProfiles: ResolvedProfiles,
  profileName?: string,
): McpHubProfile {
  const selectedProfileName = profileName ?? resolvedProfiles.defaultProfile;
  const profile = resolvedProfiles.profiles[selectedProfileName];

  if (profile === undefined) {
    throw new Error(`Unknown MCPHub profile "${selectedProfileName}".`);
  }

  return profile;
}
