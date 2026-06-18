import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config/env.js';

describe('loadConfig', () => {
  it('loads a single MCPHub profile from flat environment variables', () => {
    const config = loadConfig({
      MCPHUB_TOKEN: 'secret-token',
      MCPHUB_URL: 'https://mcphub-site.com',
    });

    expect(config.mcpHub.defaultProfile).toBe('default');
    expect(config.mcpHub.profiles.default).toEqual({
      authHeader: 'Authorization',
      token: 'secret-token',
      tokenKind: 'bearer',
      url: 'https://mcphub-site.com',
    });
  });

  it('resolves multi-profile secrets through tokenEnv indirection', () => {
    const config = loadConfig({
      MCPHUB_DEFAULT_PROFILE: 'prod',
      MCPHUB_PROFILES_JSON: JSON.stringify({
        prod: {
          tokenEnv: 'MCPHUB_PROD_TOKEN',
          tokenKind: 'bearer',
          url: 'https://prod.example.com',
        },
      }),
      MCPHUB_PROD_TOKEN: 'prod-token',
    });

    expect(config.mcpHub.profiles.prod?.token).toBe('prod-token');
  });

  it('parses token bindings with upstream profile selection and readonly features', () => {
    const config = loadConfig({
      MCPHUB_DEFAULT_PROFILE: 'prod',
      MCPHUB_PROFILES_JSON: JSON.stringify({
        prod: {
          tokenEnv: 'MCPHUB_PROD_TOKEN',
          tokenKind: 'bearer',
          url: 'https://prod.example.com',
        },
        staging: {
          tokenEnv: 'MCPHUB_STAGING_TOKEN',
          tokenKind: 'bearer',
          url: 'https://staging.example.com',
        },
      }),
      MCPHUB_PROD_TOKEN: 'prod-token',
      MCPHUB_STAGING_TOKEN: 'staging-token',
      MCP_ALLOWED_TARGET_HOSTS: 'api.example.com,registry.example.com',
      MCP_AUDIT_FILE: 'logs/audit.ndjson',
      MCP_FORCE_READONLY: 'true',
      MCP_HTTP_AUTH_TOKENS_JSON: JSON.stringify({
        'safe-prod-token': {
          exposureProfile: 'safe',
          upstreamProfileName: 'prod',
        },
        'safe-staging-token': {
          profile: 'safe',
          mcpHubProfileName: 'staging',
        },
      }),
    });

    expect(config.forceReadonly).toBe(true);
    expect(config.audit.filePath).toBe('logs/audit.ndjson');
    expect(config.security.allowedTargetHosts).toEqual(['api.example.com', 'registry.example.com']);
    expect(config.http.authTokens['safe-prod-token']).toEqual({
      exposureProfile: 'safe',
      upstreamProfileName: 'prod',
    });
    expect(config.http.authTokens['safe-staging-token']).toEqual({
      exposureProfile: 'safe',
      upstreamProfileName: 'staging',
    });
  });

  it('parses oauth and better-auth HTTP auth settings', () => {
    const config = loadConfig({
      MCPHUB_TOKEN: 'secret-token',
      MCPHUB_URL: 'https://mcphub-site.com',
      MCP_HTTP_AUTH_MODE: 'hybrid',
      MCP_HTTP_BETTER_AUTH_EXPOSURE: 'ops',
      MCP_HTTP_BETTER_AUTH_UPSTREAM_PROFILE: 'default',
      MCP_HTTP_OAUTH_CLIENT_ID: 'client-id',
      MCP_HTTP_OAUTH_CLIENT_SECRET: 'client-secret',
      MCP_HTTP_OAUTH_EXPOSURE_FALLBACK: 'admin',
      MCP_HTTP_OAUTH_INTROSPECTION_URL: 'https://auth.example.com/introspect',
      MCP_HTTP_MODE: 'stateless',
      MCP_HTTP_OAUTH_REQUIRED_SCOPE: 'mcphub:admin',
      MCP_HTTP_OAUTH_UPSTREAM_PROFILE: 'default',
    });

    expect(config.http.authMode).toBe('hybrid');
    expect(config.http.mode).toBe('stateless');
    expect(config.http.betterAuth).toEqual({
      exposureProfile: 'ops',
      upstreamProfileName: 'default',
    });
    expect(config.http.oauth).toEqual({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      exposureFallback: 'admin',
      introspectionUrl: 'https://auth.example.com/introspect',
      requiredScope: 'mcphub:admin',
      upstreamProfileName: 'default',
    });
  });

  it('supports a minimal single-token HTTP auth shortcut', () => {
    const config = loadConfig({
      MCPHUB_TOKEN: 'secret-token',
      MCPHUB_URL: 'https://mcphub-site.com',
      MCP_HTTP_AUTH_TOKEN: 'local-safe-token',
    });

    expect(config.http.authTokens).toEqual({
      'local-safe-token': {
        exposureProfile: 'safe',
      },
    });
  });

  it('loads a flat OAuth upstream profile without bearer or JWT credentials', () => {
    const config = loadConfig({
      MCPHUB_OAUTH_CLIENT_ID: 'client-id',
      MCPHUB_OAUTH_CLIENT_SECRET: 'client-secret',
      MCPHUB_OAUTH_SCOPE: 'mcphub:admin',
      MCPHUB_OAUTH_TOKEN_URL: 'https://auth.example.com/token',
      MCPHUB_TOKEN_KIND: 'oauth',
      MCPHUB_URL: 'https://mcphub-site.com',
    });

    expect(config.mcpHub.profiles.default).toEqual({
      authHeader: 'Authorization',
      oauthClientId: 'client-id',
      oauthClientSecret: 'client-secret',
      oauthScope: 'mcphub:admin',
      oauthTokenUrl: 'https://auth.example.com/token',
      tokenKind: 'oauth',
      url: 'https://mcphub-site.com',
    });
  });

  it('loads a flat Better Auth upstream profile without bearer or JWT credentials', () => {
    const config = loadConfig({
      MCPHUB_BETTER_AUTH_COOKIE: 'session=good',
      MCPHUB_TOKEN_KIND: 'better-auth',
      MCPHUB_URL: 'https://mcphub-site.com',
    });

    expect(config.mcpHub.profiles.default).toEqual({
      authHeader: 'Authorization',
      betterAuthCookie: 'session=good',
      tokenKind: 'better-auth',
      url: 'https://mcphub-site.com',
    });
  });

  it('rejects oauth HTTP auth mode without introspection metadata', () => {
    expect(() =>
      loadConfig({
        MCPHUB_TOKEN: 'secret-token',
        MCPHUB_URL: 'https://mcphub-site.com',
        MCP_HTTP_AUTH_MODE: 'oauth',
      }),
    ).toThrow(/MCP_HTTP_OAUTH_INTROSPECTION_URL/);
  });

  it('rejects invalid configuration', () => {
    expect(() => loadConfig({})).toThrow(/MCPHUB_URL|MCPHUB_PROFILES_JSON/);
  });
});
