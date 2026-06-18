// SPDX-License-Identifier: Apache-2.0

import type { ExposureProfile } from '../core/coverage/types.js';
import { exposureProfileSchema } from './schema.js';
import { envSchema } from './schema.js';
import { parseProfiles, type ResolvedProfiles } from './profiles.js';

export type HttpTokenAuthBinding = {
  exposureProfile: ExposureProfile;
  upstreamProfileName?: string | undefined;
};

export type HttpTokenProfileMap = Record<string, HttpTokenAuthBinding>;

export type AppConfig = {
  allowAuthAdminTools: boolean;
  allowMcpbUpload: boolean;
  allowSecretExport: boolean;
  allowStdioServerCreate: boolean;
  allowSystemConfigWrite: boolean;
  audit: {
    filePath?: string | undefined;
    maxBytes: number;
    maxFiles: number;
  };
  defaultExposure: ExposureProfile;
  exposedProfiles: ExposureProfile[];
  forceReadonly: boolean;
  http: {
    allowedHosts: string[];
    allowedOrigins: string[];
    authMode: 'better-auth' | 'hybrid' | 'oauth' | 'static';
    authTokens: HttpTokenProfileMap;
    betterAuth: {
      exposureProfile: ExposureProfile;
      upstreamProfileName?: string | undefined;
    };
    bodyLimit: number;
    host: string;
    mode: 'stateful' | 'stateless';
    oauth: {
      clientId?: string | undefined;
      clientSecret?: string | undefined;
      exposureFallback: ExposureProfile;
      introspectionUrl?: string | undefined;
      requiredScope?: string | undefined;
      upstreamProfileName?: string | undefined;
    };
    port: number;
  };
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  mcpHub: ResolvedProfiles;
  redactSecrets: boolean;
  request: {
    retryAttempts: number;
    retryBackoffMs: number;
    timeoutMs: number;
  };
  security: {
    allowedTargetHosts: string[];
  };
};

function parseCommaList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseExposureProfiles(value: string): ExposureProfile[] {
  const profiles = parseCommaList(value).map((item) => envSchema.shape.MCP_DEFAULT_EXPOSURE.parse(item));

  if (profiles.length === 0) {
    throw new Error('MCP_EXPOSE_ENDPOINTS must contain at least one exposure profile.');
  }

  return [...new Set(profiles)];
}

function parseAuthTokens(value?: string): HttpTokenProfileMap {
  if (value === undefined) {
    return {};
  }

  const parsed = JSON.parse(value) as Record<string, unknown>;
  const authTokens: HttpTokenProfileMap = {};

  for (const [token, rawBinding] of Object.entries(parsed)) {
    if (typeof rawBinding === 'string') {
      authTokens[token] = {
        exposureProfile: exposureProfileSchema.parse(rawBinding),
      };
      continue;
    }

    if (rawBinding === null || typeof rawBinding !== 'object') {
      throw new Error(`Invalid HTTP auth token binding for token "${token}".`);
    }

    const binding = rawBinding as Record<string, unknown>;
    const exposureValue = binding.exposureProfile ?? binding.profile;
    const upstreamProfileValue = binding.upstreamProfileName ?? binding.mcpHubProfileName;

    authTokens[token] = {
      exposureProfile: exposureProfileSchema.parse(exposureValue),
      ...(typeof upstreamProfileValue === 'string' && upstreamProfileValue.length > 0
        ? { upstreamProfileName: upstreamProfileValue }
        : {}),
    };
  }

  return authTokens;
}

function resolveHttpAuthTokens(parsedEnv: ReturnType<typeof envSchema.parse>): HttpTokenProfileMap {
  if (parsedEnv.MCP_HTTP_AUTH_TOKENS_JSON !== undefined) {
    return parseAuthTokens(parsedEnv.MCP_HTTP_AUTH_TOKENS_JSON);
  }

  if (parsedEnv.MCP_HTTP_AUTH_TOKEN === undefined) {
    return {};
  }

  return {
    [parsedEnv.MCP_HTTP_AUTH_TOKEN]: {
      exposureProfile: parsedEnv.MCP_HTTP_AUTH_EXPOSURE,
    },
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsedEnv = envSchema.parse(env);

  return {
    allowAuthAdminTools: parsedEnv.ALLOW_AUTH_ADMIN_TOOLS,
    allowMcpbUpload: parsedEnv.ALLOW_MCPB_UPLOAD,
    allowSecretExport: parsedEnv.ALLOW_SECRET_EXPORT,
    allowStdioServerCreate: parsedEnv.ALLOW_STDIO_SERVER_CREATE,
    allowSystemConfigWrite: parsedEnv.ALLOW_SYSTEM_CONFIG_WRITE,
    audit: {
      ...(parsedEnv.MCP_AUDIT_FILE !== undefined ? { filePath: parsedEnv.MCP_AUDIT_FILE } : {}),
      maxBytes: parsedEnv.MCP_AUDIT_MAX_BYTES,
      maxFiles: parsedEnv.MCP_AUDIT_MAX_FILES,
    },
    defaultExposure: parsedEnv.MCP_DEFAULT_EXPOSURE,
    exposedProfiles: parseExposureProfiles(parsedEnv.MCP_EXPOSE_ENDPOINTS),
    forceReadonly: parsedEnv.MCP_FORCE_READONLY,
    http: {
      allowedHosts: parseCommaList(parsedEnv.MCP_HTTP_ALLOWED_HOSTS),
      allowedOrigins: parseCommaList(parsedEnv.MCP_HTTP_ALLOWED_ORIGINS),
      authMode: parsedEnv.MCP_HTTP_AUTH_MODE,
      authTokens: resolveHttpAuthTokens(parsedEnv),
      betterAuth: {
        exposureProfile: parsedEnv.MCP_HTTP_BETTER_AUTH_EXPOSURE,
        ...(parsedEnv.MCP_HTTP_BETTER_AUTH_UPSTREAM_PROFILE !== undefined
          ? { upstreamProfileName: parsedEnv.MCP_HTTP_BETTER_AUTH_UPSTREAM_PROFILE }
          : {}),
      },
      bodyLimit: parsedEnv.MCP_HTTP_BODY_LIMIT,
      host: parsedEnv.MCP_HTTP_HOST,
      mode: parsedEnv.MCP_HTTP_MODE,
      oauth: {
        ...(parsedEnv.MCP_HTTP_OAUTH_CLIENT_ID !== undefined
          ? { clientId: parsedEnv.MCP_HTTP_OAUTH_CLIENT_ID }
          : {}),
        ...(parsedEnv.MCP_HTTP_OAUTH_CLIENT_SECRET !== undefined
          ? { clientSecret: parsedEnv.MCP_HTTP_OAUTH_CLIENT_SECRET }
          : {}),
        exposureFallback: parsedEnv.MCP_HTTP_OAUTH_EXPOSURE_FALLBACK,
        ...(parsedEnv.MCP_HTTP_OAUTH_INTROSPECTION_URL !== undefined
          ? { introspectionUrl: parsedEnv.MCP_HTTP_OAUTH_INTROSPECTION_URL }
          : {}),
        ...(parsedEnv.MCP_HTTP_OAUTH_REQUIRED_SCOPE !== undefined
          ? { requiredScope: parsedEnv.MCP_HTTP_OAUTH_REQUIRED_SCOPE }
          : {}),
        ...(parsedEnv.MCP_HTTP_OAUTH_UPSTREAM_PROFILE !== undefined
          ? { upstreamProfileName: parsedEnv.MCP_HTTP_OAUTH_UPSTREAM_PROFILE }
          : {}),
      },
      port: parsedEnv.MCP_HTTP_PORT,
    },
    logLevel: parsedEnv.MCP_LOG_LEVEL,
    mcpHub: parseProfiles(parsedEnv, env),
    redactSecrets: parsedEnv.MCP_REDACT_SECRETS,
    request: {
      retryAttempts: parsedEnv.MCPHUB_REQUEST_RETRY_ATTEMPTS,
      retryBackoffMs: parsedEnv.MCPHUB_REQUEST_RETRY_BACKOFF_MS,
      timeoutMs: parsedEnv.MCPHUB_REQUEST_TIMEOUT_MS,
    },
    security: {
      allowedTargetHosts: parseCommaList(parsedEnv.MCP_ALLOWED_TARGET_HOSTS),
    },
  };
}
