// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';

import {
  DEFAULT_HTTP_BODY_LIMIT,
  DEFAULT_HTTP_HOST,
  DEFAULT_HTTP_MODE,
  DEFAULT_HTTP_PORT,
  DEFAULT_LOG_LEVEL,
  DEFAULT_AUDIT_MAX_BYTES,
  DEFAULT_AUDIT_MAX_FILES,
  DEFAULT_MCPHUB_AUTH_HEADER,
  DEFAULT_MCPHUB_RETRY_ATTEMPTS,
  DEFAULT_MCPHUB_RETRY_BACKOFF_MS,
  DEFAULT_MCPHUB_TIMEOUT_MS,
} from './defaults.js';

const booleanStringSchema = z.enum(['true', 'false']).transform((value) => value === 'true');
const optionalBooleanStringSchema = booleanStringSchema.optional();
const positiveIntegerStringSchema = z
  .string()
  .regex(/^\d+$/)
  .transform((value) => Number.parseInt(value, 10));

export const exposureProfileSchema = z.enum(['safe', 'ops', 'admin', 'all']);
export const tokenKindSchema = z.enum(['bearer', 'jwt', 'oauth', 'better-auth']);
export const authHeaderSchema = z.enum(['Authorization', 'x-auth-token']);
export const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);
export const httpAuthModeSchema = z.enum(['static', 'oauth', 'better-auth', 'hybrid']);
export const httpModeSchema = z.enum(['stateful', 'stateless']);

export const mcpHubProfileSchema = z
  .object({
    authHeader: authHeaderSchema.default(DEFAULT_MCPHUB_AUTH_HEADER),
    betterAuthCookie: z.string().min(1).optional(),
    betterAuthCookieEnv: z.string().min(1).optional(),
    oauthClientId: z.string().min(1).optional(),
    oauthClientIdEnv: z.string().min(1).optional(),
    oauthClientSecret: z.string().min(1).optional(),
    oauthClientSecretEnv: z.string().min(1).optional(),
    oauthScope: z.string().min(1).optional(),
    oauthTokenUrl: z.string().min(1).optional(),
    oauthTokenUrlEnv: z.string().min(1).optional(),
    password: z.string().min(1).optional(),
    passwordEnv: z.string().min(1).optional(),
    token: z.string().min(1).optional(),
    tokenEnv: z.string().min(1).optional(),
    tokenKind: tokenKindSchema.default('bearer'),
    url: z.url(),
    username: z.string().min(1).optional(),
    usernameEnv: z.string().min(1).optional(),
  })
  .superRefine((profile, context) => {
    const hasToken = profile.token !== undefined || profile.tokenEnv !== undefined;
    const hasJwtCredentials =
      (profile.username !== undefined || profile.usernameEnv !== undefined) &&
      (profile.password !== undefined || profile.passwordEnv !== undefined);
    const hasOAuthCredentials =
      (profile.oauthClientId !== undefined || profile.oauthClientIdEnv !== undefined) &&
      (profile.oauthClientSecret !== undefined || profile.oauthClientSecretEnv !== undefined) &&
      (profile.oauthTokenUrl !== undefined || profile.oauthTokenUrlEnv !== undefined);
    const hasBetterAuthCookie = profile.betterAuthCookie !== undefined || profile.betterAuthCookieEnv !== undefined;

    if (!hasToken && !hasJwtCredentials && !hasOAuthCredentials && !hasBetterAuthCookie) {
      context.addIssue({
        code: 'custom',
        message:
          'Each MCPHub profile needs a token, username/password, OAuth client credentials, or a Better Auth cookie.',
        path: ['token'],
      });
    }

    if (profile.tokenKind === 'jwt' && !hasToken && !hasJwtCredentials) {
      context.addIssue({
        code: 'custom',
        message: 'JWT profiles require either a token or login credentials.',
        path: ['tokenKind'],
      });
    }

    if (profile.tokenKind === 'oauth' && !hasToken && !hasOAuthCredentials) {
      context.addIssue({
        code: 'custom',
        message: 'OAuth profiles require an access token or OAuth client credentials.',
        path: ['tokenKind'],
      });
    }

    if (profile.tokenKind === 'better-auth' && !hasBetterAuthCookie) {
      context.addIssue({
        code: 'custom',
        message: 'Better Auth profiles require a cookie value or cookie env indirection.',
        path: ['tokenKind'],
      });
    }
  });

export const envSchema = z
  .object({
    ALLOW_AUTH_ADMIN_TOOLS: optionalBooleanStringSchema.default(false),
    ALLOW_MCPB_UPLOAD: optionalBooleanStringSchema.default(false),
    ALLOW_SECRET_EXPORT: optionalBooleanStringSchema.default(false),
    ALLOW_STDIO_SERVER_CREATE: optionalBooleanStringSchema.default(false),
    ALLOW_SYSTEM_CONFIG_WRITE: optionalBooleanStringSchema.default(false),
    MCP_ALLOWED_TARGET_HOSTS: z.string().default(''),
    MCP_AUDIT_FILE: z.string().min(1).optional(),
    MCP_AUDIT_MAX_BYTES: positiveIntegerStringSchema.default(DEFAULT_AUDIT_MAX_BYTES),
    MCP_AUDIT_MAX_FILES: positiveIntegerStringSchema.default(DEFAULT_AUDIT_MAX_FILES),
    MCP_DEFAULT_EXPOSURE: exposureProfileSchema.default('safe'),
    MCP_EXPOSE_ENDPOINTS: z.string().default('safe,ops,admin,all'),
    MCP_FORCE_READONLY: optionalBooleanStringSchema.default(false),
    MCP_HTTP_AUTH_MODE: httpAuthModeSchema.default('static'),
    MCP_HTTP_ALLOWED_HOSTS: z.string().default('127.0.0.1,localhost'),
    MCP_HTTP_ALLOWED_ORIGINS: z.string().default(''),
    MCP_HTTP_AUTH_EXPOSURE: exposureProfileSchema.default('safe'),
    MCP_HTTP_AUTH_TOKEN: z.string().min(1).optional(),
    MCP_HTTP_AUTH_TOKENS_JSON: z.string().optional(),
    MCP_HTTP_BETTER_AUTH_EXPOSURE: exposureProfileSchema.default('safe'),
    MCP_HTTP_BETTER_AUTH_UPSTREAM_PROFILE: z.string().min(1).optional(),
    MCP_HTTP_BODY_LIMIT: positiveIntegerStringSchema.default(DEFAULT_HTTP_BODY_LIMIT),
    MCP_HTTP_HOST: z.string().min(1).default(DEFAULT_HTTP_HOST),
    MCP_HTTP_MODE: httpModeSchema.default(DEFAULT_HTTP_MODE),
    MCP_HTTP_OAUTH_CLIENT_ID: z.string().min(1).optional(),
    MCP_HTTP_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
    MCP_HTTP_OAUTH_EXPOSURE_FALLBACK: exposureProfileSchema.default('safe'),
    MCP_HTTP_OAUTH_INTROSPECTION_URL: z.string().min(1).optional(),
    MCP_HTTP_OAUTH_REQUIRED_SCOPE: z.string().min(1).optional(),
    MCP_HTTP_OAUTH_UPSTREAM_PROFILE: z.string().min(1).optional(),
    MCP_HTTP_PORT: positiveIntegerStringSchema.default(DEFAULT_HTTP_PORT),
    MCP_LOG_LEVEL: logLevelSchema.default(DEFAULT_LOG_LEVEL),
    MCP_REDACT_SECRETS: optionalBooleanStringSchema.default(true),
    MCPHUB_AUTH_HEADER: authHeaderSchema.default(DEFAULT_MCPHUB_AUTH_HEADER),
    MCPHUB_BETTER_AUTH_COOKIE: z.string().min(1).optional(),
    MCPHUB_DEFAULT_PROFILE: z.string().min(1).default('default'),
    MCPHUB_OAUTH_CLIENT_ID: z.string().min(1).optional(),
    MCPHUB_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
    MCPHUB_OAUTH_SCOPE: z.string().min(1).optional(),
    MCPHUB_OAUTH_TOKEN_URL: z.string().min(1).optional(),
    MCPHUB_PASSWORD: z.string().min(1).optional(),
    MCPHUB_PROFILES_JSON: z.string().optional(),
    MCPHUB_REQUEST_RETRY_ATTEMPTS: positiveIntegerStringSchema.default(DEFAULT_MCPHUB_RETRY_ATTEMPTS),
    MCPHUB_REQUEST_RETRY_BACKOFF_MS: positiveIntegerStringSchema.default(DEFAULT_MCPHUB_RETRY_BACKOFF_MS),
    MCPHUB_REQUEST_TIMEOUT_MS: positiveIntegerStringSchema.default(DEFAULT_MCPHUB_TIMEOUT_MS),
    MCPHUB_TOKEN: z.string().min(1).optional(),
    MCPHUB_TOKEN_KIND: tokenKindSchema.default('bearer'),
    MCPHUB_URL: z.url().optional(),
    MCPHUB_USERNAME: z.string().min(1).optional(),
  })
  .superRefine((env, context) => {
    if (env.MCPHUB_PROFILES_JSON === undefined && env.MCPHUB_URL === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'Provide MCPHUB_URL or MCPHUB_PROFILES_JSON.',
        path: ['MCPHUB_URL'],
      });
    }

    const hasFlatToken = env.MCPHUB_TOKEN !== undefined;
    const hasFlatJwtCredentials = env.MCPHUB_USERNAME !== undefined && env.MCPHUB_PASSWORD !== undefined;
    const hasFlatOAuthCredentials =
      env.MCPHUB_OAUTH_CLIENT_ID !== undefined &&
      env.MCPHUB_OAUTH_CLIENT_SECRET !== undefined &&
      env.MCPHUB_OAUTH_TOKEN_URL !== undefined;
    const hasFlatBetterAuthCookie = env.MCPHUB_BETTER_AUTH_COOKIE !== undefined;

    if (
      env.MCPHUB_PROFILES_JSON === undefined &&
      !hasFlatToken &&
      !hasFlatJwtCredentials &&
      !hasFlatOAuthCredentials &&
      !hasFlatBetterAuthCookie
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'Provide MCPHUB_TOKEN, MCPHUB_USERNAME/MCPHUB_PASSWORD, MCPHUB_OAUTH_CLIENT_ID/MCPHUB_OAUTH_CLIENT_SECRET/MCPHUB_OAUTH_TOKEN_URL, or MCPHUB_BETTER_AUTH_COOKIE.',
        path: ['MCPHUB_TOKEN'],
      });
    }

    if (
      (env.MCP_HTTP_AUTH_MODE === 'oauth' || env.MCP_HTTP_AUTH_MODE === 'hybrid') &&
      env.MCP_HTTP_OAUTH_INTROSPECTION_URL === undefined
    ) {
      context.addIssue({
        code: 'custom',
        message: 'OAuth HTTP auth modes require MCP_HTTP_OAUTH_INTROSPECTION_URL.',
        path: ['MCP_HTTP_OAUTH_INTROSPECTION_URL'],
      });
    }
  });

export type RawEnv = z.infer<typeof envSchema>;
export type McpHubProfileInput = z.infer<typeof mcpHubProfileSchema>;
