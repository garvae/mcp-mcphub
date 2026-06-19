import { Writable } from 'node:stream';

import { loadCommandEnv } from '../../src/cli/config-loader.js';
import { loadConfig } from '../../src/config/env.js';
import { createConfiguredMcpHubClient } from '../../src/core/mcphub-client/factory.js';
import { createLogger } from '../../src/observability/logger.js';

export type RealTestEnvironment = {
  authHeader: 'Authorization' | 'x-auth-token';
  fixturePrefix: string;
  httpAuthToken: string;
  mutationEnabled: boolean;
  profileName?: string | undefined;
  readonlyEnabled: boolean;
  releaseRequired: boolean;
  source: NodeJS.ProcessEnv;
  token: string;
  tokenKind: 'bearer' | 'better-auth' | 'jwt' | 'oauth';
  url: string;
};

function readString(env: NodeJS.ProcessEnv, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

export function getRealTestEnvironment(): RealTestEnvironment {
  const env = loadCommandEnv(undefined, process.env);
  const url = readString(env, 'REAL_TEST_MCPHUB_URL', 'MCPHUB_URL');
  const token = readString(env, 'REAL_TEST_MCPHUB_TOKEN', 'MCPHUB_TOKEN');

  return {
    authHeader: (readString(env, 'REAL_TEST_MCPHUB_AUTH_HEADER', 'MCPHUB_AUTH_HEADER') ??
      'Authorization') as 'Authorization' | 'x-auth-token',
    fixturePrefix: readString(env, 'REAL_TEST_FIXTURE_PREFIX') ?? 'mcp-mcphub-test',
    httpAuthToken:
      readString(env, 'REAL_TEST_HTTP_AUTH_TOKEN', 'MCP_HTTP_AUTH_TOKEN') ?? 'real-safe-token',
    mutationEnabled:
      env.RUN_REAL_MCPHUB_MUTATION_TESTS === '1' && url !== undefined && token !== undefined,
    profileName: readString(env, 'REAL_TEST_MCPHUB_PROFILE', 'MCPHUB_DEFAULT_PROFILE'),
    readonlyEnabled: env.RUN_REAL_MCPHUB_TESTS === '1' && url !== undefined && token !== undefined,
    releaseRequired: env.RELEASE_REAL_TESTS_REQUIRED === '1',
    source: env,
    token: token ?? '',
    tokenKind: (readString(env, 'REAL_TEST_MCPHUB_TOKEN_KIND', 'MCPHUB_TOKEN_KIND') ?? 'bearer') as
      | 'bearer'
      | 'better-auth'
      | 'jwt'
      | 'oauth',
    url: url ?? '',
  };
}

export function requireRealSuite(env: RealTestEnvironment, scope: 'mutation' | 'readonly'): void {
  const enabled = scope === 'mutation' ? env.mutationEnabled : env.readonlyEnabled;
  if (enabled) {
    return;
  }

  const flag =
    scope === 'mutation' ? 'RUN_REAL_MCPHUB_MUTATION_TESTS=1' : 'RUN_REAL_MCPHUB_TESTS=1';
  const message = `Real ${scope} tests are disabled. Set ${flag} and provide REAL_TEST_MCPHUB_URL + REAL_TEST_MCPHUB_TOKEN.`;

  if (env.releaseRequired) {
    throw new Error(message);
  }
}

export function createSilentLogger() {
  return createLogger(
    'error',
    new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    }) as NodeJS.WriteStream,
  );
}

export function createRealRuntimeEnv(
  env: RealTestEnvironment,
  overrides: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  return {
    MCPHUB_AUTH_HEADER: env.authHeader,
    MCPHUB_TOKEN: env.token,
    MCPHUB_TOKEN_KIND: env.tokenKind,
    MCPHUB_URL: env.url,
    MCP_HTTP_ALLOWED_HOSTS: '127.0.0.1,localhost',
    MCP_HTTP_ALLOWED_ORIGINS: 'https://real-tests.example',
    MCP_HTTP_AUTH_EXPOSURE: 'safe',
    MCP_HTTP_AUTH_TOKEN: env.httpAuthToken,
    MCP_HTTP_HOST: '127.0.0.1',
    MCP_HTTP_PORT: '0',
    MCP_LOG_LEVEL: 'error',
    ...(env.profileName !== undefined ? { MCPHUB_DEFAULT_PROFILE: env.profileName } : {}),
    ...overrides,
  };
}

export function createRealClient(env: RealTestEnvironment) {
  const config = loadConfig(
    createRealRuntimeEnv(env, {
      MCP_HTTP_AUTH_TOKEN: undefined,
      MCP_HTTP_AUTH_TOKENS_JSON: undefined,
    }),
  );

  return createConfiguredMcpHubClient(config, createSilentLogger(), env.profileName);
}
