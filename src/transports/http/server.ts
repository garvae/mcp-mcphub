// SPDX-License-Identifier: Apache-2.0

import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import type { AppConfig } from '../../config/env.js';
import { resolveProfileByName } from '../../config/profiles.js';
import { createConfiguredMcpHubClient } from '../../core/mcphub-client/factory.js';
import { createRedactor } from '../../core/redaction/redactor.js';
import type { ExposureProfile } from '../../core/coverage/types.js';
import { createManagedMcpServer } from '../../mcp/server.js';
import { createAuditLogger } from '../../observability/audit.js';
import { createLogger, type Logger } from '../../observability/logger.js';
import { handleStatelessHttpRequest } from './stateless.js';

const exposureRank: Record<ExposureProfile, number> = {
  safe: 0,
  ops: 1,
  admin: 2,
  all: 3,
};

const defaultRateLimit = {
  maxRequests: 60,
  windowMs: 60_000,
};
const authValidationTimeoutCapMs = 5_000;
const statefulAllowedMethods = new Set(['DELETE', 'GET', 'POST']);

type HttpAuthResult = {
  actor: string;
  grantedProfile: ExposureProfile;
  rateLimitKey: string;
  upstreamProfileName?: string | undefined;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export type StartHttpServerOptions = {
  config: AppConfig;
  forceReadonly?: boolean | undefined;
  host?: string | undefined;
  logger?: Logger | undefined;
  mcpHubProfileName?: string | undefined;
  port?: number | undefined;
  rateLimitMaxRequests?: number | undefined;
  rateLimitWindowMs?: number | undefined;
};

export type StartedHttpServer = {
  close: () => Promise<void>;
  port: number;
  server: Server;
};

function createPassthroughRedactor() {
  return {
    redactString(value: string): string {
      return value;
    },
    redactValue<T>(value: T): T {
      return value;
    },
  };
}

function extractProfileFromPath(pathname: string): ExposureProfile | undefined {
  switch (pathname) {
    case '/mcp/safe':
      return 'safe';
    case '/mcp/ops':
      return 'ops';
    case '/mcp/admin':
      return 'admin';
    case '/mcp/all':
      return 'all';
    default:
      return undefined;
  }
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify(payload));
}

function normalizeHostHeader(hostHeader: string): string {
  if (hostHeader.startsWith('[')) {
    const closingBracket = hostHeader.indexOf(']');
    return closingBracket === -1 ? hostHeader : hostHeader.slice(0, closingBracket + 1);
  }

  const [hostname] = hostHeader.split(':');
  return hostname ?? hostHeader;
}

function isHostAllowed(request: IncomingMessage, allowedHosts: readonly string[]): boolean {
  if (allowedHosts.length === 0) {
    return true;
  }

  const hostHeader = request.headers.host;
  if (hostHeader === undefined) {
    return false;
  }

  const normalizedHost = normalizeHostHeader(hostHeader).toLowerCase();
  return allowedHosts.some((candidate) => candidate.toLowerCase() === normalizedHost);
}

function isOriginAllowed(origin: string | undefined, allowedOrigins: readonly string[]): boolean {
  if (origin === undefined) {
    return true;
  }

  if (allowedOrigins.length === 0) {
    return false;
  }

  return allowedOrigins.includes('*') || allowedOrigins.includes(origin);
}

function applyCorsHeaders(
  response: ServerResponse,
  origin: string | undefined,
  allowedOrigins: readonly string[],
): void {
  response.setHeader('vary', 'Origin');
  response.setHeader('access-control-allow-headers', 'authorization, content-type, x-auth-token');
  response.setHeader('access-control-allow-methods', 'DELETE, GET, OPTIONS, POST');

  if (origin !== undefined && isOriginAllowed(origin, allowedOrigins)) {
    response.setHeader('access-control-allow-origin', origin);
  }
}

function extractBearerToken(request: IncomingMessage): string | undefined {
  const authorizationHeader = request.headers.authorization;
  const customTokenHeader = request.headers['x-auth-token'];

  return typeof authorizationHeader === 'string' && authorizationHeader.startsWith('Bearer ')
    ? authorizationHeader.slice('Bearer '.length)
    : typeof customTokenHeader === 'string'
      ? customTokenHeader
      : undefined;
}

function fingerprintSecret(prefix: string, value: string): string {
  return `${prefix}:${createHash('sha256').update(value).digest('hex').slice(0, 24)}`;
}

function timingSafeTokenMatch(candidate: string, token: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const tokenBuffer = Buffer.from(token);

  if (candidateBuffer.length !== tokenBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, tokenBuffer);
}

function resolveAuthValidationTimeoutMs(config: AppConfig): number {
  return Math.max(1, Math.min(config.request.timeoutMs, authValidationTimeoutCapMs));
}

function tryStaticTokenAuth(
  request: IncomingMessage,
  authTokens: AppConfig['http']['authTokens'],
  requestedProfile: ExposureProfile,
): HttpAuthResult | undefined {
  const token = extractBearerToken(request);
  if (token === undefined) {
    return undefined;
  }

  const matchedBinding = Object.entries(authTokens).find(([candidateToken]) =>
    timingSafeTokenMatch(candidateToken, token),
  );
  if (matchedBinding === undefined) {
    return undefined;
  }

  const [, binding] = matchedBinding;

  if (exposureRank[binding.exposureProfile] < exposureRank[requestedProfile]) {
    return undefined;
  }

  return {
    actor: `profile:${binding.exposureProfile}`,
    grantedProfile: binding.exposureProfile,
    rateLimitKey: fingerprintSecret('static', token),
    ...(binding.upstreamProfileName !== undefined
      ? { upstreamProfileName: binding.upstreamProfileName }
      : {}),
  };
}

type OAuthIntrospectionResponse = {
  active?: boolean;
  mcp_profile?: string;
  scope?: string;
  sub?: string;
  upstream_profile?: string;
  username?: string;
};

function resolveExposureFromScope(
  scope: string | undefined,
  fallback: ExposureProfile,
): ExposureProfile {
  if (scope === undefined) {
    return fallback;
  }

  const scopes = new Set(scope.split(/\s+/u).filter((entry) => entry.length > 0));

  if (scopes.has('mcphub:all') || scopes.has('all')) {
    return 'all';
  }

  if (scopes.has('mcphub:admin') || scopes.has('admin')) {
    return 'admin';
  }

  if (scopes.has('mcphub:ops') || scopes.has('ops')) {
    return 'ops';
  }

  return 'safe';
}

async function tryOAuthAuth(
  request: IncomingMessage,
  config: AppConfig,
  requestedProfile: ExposureProfile,
): Promise<HttpAuthResult | undefined> {
  const token = extractBearerToken(request);
  const introspectionUrl = config.http.oauth.introspectionUrl;

  if (token === undefined || introspectionUrl === undefined) {
    return undefined;
  }

  const body = new URLSearchParams({
    token,
    ...(config.http.oauth.clientId !== undefined ? { client_id: config.http.oauth.clientId } : {}),
    ...(config.http.oauth.clientSecret !== undefined
      ? { client_secret: config.http.oauth.clientSecret }
      : {}),
  });
  const response = await fetch(introspectionUrl, {
    body,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
    signal: AbortSignal.timeout(resolveAuthValidationTimeoutMs(config)),
  });

  if (!response.ok) {
    return undefined;
  }

  const payload = (await response.json()) as OAuthIntrospectionResponse;
  if (payload.active !== true) {
    return undefined;
  }

  if (config.http.oauth.requiredScope !== undefined) {
    const scopes = new Set((payload.scope ?? '').split(/\s+/u).filter((entry) => entry.length > 0));
    if (!scopes.has(config.http.oauth.requiredScope)) {
      return undefined;
    }
  }

  const grantedProfile = exposureProfileFromOAuth(payload, config);
  if (exposureRank[grantedProfile] < exposureRank[requestedProfile]) {
    return undefined;
  }

  return {
    actor: payload.username ?? payload.sub ?? 'oauth-client',
    grantedProfile,
    rateLimitKey: fingerprintSecret('oauth', token),
    ...(payload.upstream_profile !== undefined
      ? { upstreamProfileName: payload.upstream_profile }
      : config.http.oauth.upstreamProfileName !== undefined
        ? { upstreamProfileName: config.http.oauth.upstreamProfileName }
        : {}),
  };
}

function exposureProfileFromOAuth(
  payload: OAuthIntrospectionResponse,
  config: AppConfig,
): ExposureProfile {
  if (payload.mcp_profile !== undefined) {
    return ['safe', 'ops', 'admin', 'all'].includes(payload.mcp_profile)
      ? (payload.mcp_profile as ExposureProfile)
      : config.http.oauth.exposureFallback;
  }

  return resolveExposureFromScope(payload.scope, config.http.oauth.exposureFallback);
}

async function tryBetterAuthAuth(
  request: IncomingMessage,
  config: AppConfig,
  requestedProfile: ExposureProfile,
  defaultUpstreamProfileName?: string,
): Promise<HttpAuthResult | undefined> {
  const cookieHeader = request.headers.cookie;
  if (typeof cookieHeader !== 'string' || cookieHeader.length === 0) {
    return undefined;
  }

  const upstreamProfileName =
    config.http.betterAuth.upstreamProfileName ??
    defaultUpstreamProfileName ??
    config.mcpHub.defaultProfile;
  const upstreamProfile = resolveProfileByName(config.mcpHub, upstreamProfileName);
  const response = await fetch(new URL('/api/better-auth/user', upstreamProfile.url), {
    headers: {
      Cookie: cookieHeader,
    },
    method: 'GET',
    signal: AbortSignal.timeout(resolveAuthValidationTimeoutMs(config)),
  });

  if (!response.ok) {
    return undefined;
  }

  const payload = (await response.json()) as { email?: string; id?: string; username?: string };
  const grantedProfile = config.http.betterAuth.exposureProfile;
  if (exposureRank[grantedProfile] < exposureRank[requestedProfile]) {
    return undefined;
  }

  return {
    actor: payload.username ?? payload.email ?? payload.id ?? 'better-auth-user',
    grantedProfile,
    rateLimitKey: fingerprintSecret('better-auth', cookieHeader),
    upstreamProfileName,
  };
}

async function authenticateHttpRequest(
  request: IncomingMessage,
  config: AppConfig,
  requestedProfile: ExposureProfile,
  defaultUpstreamProfileName?: string,
): Promise<HttpAuthResult | undefined> {
  const mode = config.http.authMode;

  if (mode === 'static') {
    return tryStaticTokenAuth(request, config.http.authTokens, requestedProfile);
  }

  if (mode === 'oauth') {
    return tryOAuthAuth(request, config, requestedProfile);
  }

  if (mode === 'better-auth') {
    return tryBetterAuthAuth(request, config, requestedProfile, defaultUpstreamProfileName);
  }

  return (
    tryStaticTokenAuth(request, config.http.authTokens, requestedProfile) ??
    (await tryOAuthAuth(request, config, requestedProfile)) ??
    (await tryBetterAuthAuth(request, config, requestedProfile, defaultUpstreamProfileName))
  );
}

async function readJsonBody(request: IncomingMessage, bodyLimit: number): Promise<unknown> {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    return undefined;
  }

  const chunks: Buffer[] = [];
  let totalLength = 0;

  for await (const chunk of request) {
    const normalizedChunk = Buffer.from(chunk as string | Uint8Array);
    totalLength += normalizedChunk.length;
    if (totalLength > bodyLimit) {
      throw new Error(`Request body exceeds configured limit of ${String(bodyLimit)} bytes.`);
    }

    chunks.push(normalizedChunk);
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const bodyText = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(bodyText);
}

function checkRateLimit(
  buckets: Map<string, RateLimitBucket>,
  key: string,
  maxRequests: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const current = buckets.get(key);

  if (current === undefined || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (current.count >= maxRequests) {
    return true;
  }

  current.count += 1;
  return false;
}

function isMethodAllowedForMode(
  method: string | undefined,
  mode: AppConfig['http']['mode'],
): boolean {
  if (method === undefined) {
    return false;
  }

  if (mode === 'stateless') {
    return method === 'POST';
  }

  return statefulAllowedMethods.has(method);
}

export async function startHttpServer(options: StartHttpServerOptions): Promise<StartedHttpServer> {
  const host = options.host ?? options.config.http.host;
  const port = options.port ?? options.config.http.port;
  const logger = options.logger ?? createLogger(options.config.logLevel);
  const auditLogger = createAuditLogger(logger, options.config.audit);
  const redactor = options.config.redactSecrets ? createRedactor() : createPassthroughRedactor();
  const rateLimitBuckets = new Map<string, RateLimitBucket>();
  const rateLimitMaxRequests = options.rateLimitMaxRequests ?? defaultRateLimit.maxRequests;
  const rateLimitWindowMs = options.rateLimitWindowMs ?? defaultRateLimit.windowMs;

  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    const pathname = requestUrl.pathname;
    const origin = typeof request.headers.origin === 'string' ? request.headers.origin : undefined;

    try {
      if (!isHostAllowed(request, options.config.http.allowedHosts)) {
        writeJson(response, 403, { error: 'Host header is not allowed.' });
        return;
      }

      if (pathname === '/healthz') {
        writeJson(response, 200, { status: 'ok' });
        return;
      }

      const requestedProfile = extractProfileFromPath(pathname);
      if (requestedProfile === undefined) {
        writeJson(response, 404, { error: 'Not found.' });
        return;
      }

      applyCorsHeaders(response, origin, options.config.http.allowedOrigins);
      response.setHeader('cache-control', 'no-store');

      if (request.method === 'OPTIONS') {
        if (!isOriginAllowed(origin, options.config.http.allowedOrigins)) {
          writeJson(response, 403, { error: 'Origin is not allowed.' });
          return;
        }

        response.statusCode = 204;
        response.end();
        return;
      }

      if (!isOriginAllowed(origin, options.config.http.allowedOrigins)) {
        writeJson(response, 403, { error: 'Origin is not allowed.' });
        return;
      }

      if (!isMethodAllowedForMode(request.method, options.config.http.mode)) {
        response.setHeader(
          'allow',
          options.config.http.mode === 'stateless' ? 'POST' : 'DELETE, GET, POST',
        );
        writeJson(response, 405, { error: 'Method not allowed.' });
        return;
      }

      const auth = await authenticateHttpRequest(
        request,
        options.config,
        requestedProfile,
        options.mcpHubProfileName,
      );
      if (auth === undefined) {
        writeJson(response, 401, { error: 'Unauthorized.' });
        return;
      }

      if (
        checkRateLimit(
          rateLimitBuckets,
          `${auth.rateLimitKey}:${pathname}`,
          rateLimitMaxRequests,
          rateLimitWindowMs,
        )
      ) {
        writeJson(response, 429, { error: 'Rate limit exceeded.' });
        return;
      }

      const parsedBody = await readJsonBody(request, options.config.http.bodyLimit);

      if (options.config.http.mode === 'stateless') {
        await handleStatelessHttpRequest({
          actor: auth.actor,
          auditLogger,
          config: options.config,
          forceReadonly: options.forceReadonly ?? options.config.forceReadonly,
          logger,
          parsedBody,
          redactor,
          request,
          requestedProfile,
          response,
          upstreamProfileName: auth.upstreamProfileName ?? options.mcpHubProfileName,
        });
        return;
      }

      const client = createConfiguredMcpHubClient(
        options.config,
        logger,
        auth.upstreamProfileName ?? options.mcpHubProfileName,
      );
      const transport = new StreamableHTTPServerTransport();
      const mcpServer = createManagedMcpServer({
        client,
        enableResources: false,
        exposureProfile: requestedProfile,
        featureFlags: {
          allowAuthAdminTools: options.config.allowAuthAdminTools,
          allowMcpbUpload: options.config.allowMcpbUpload,
          allowStdioServerCreate: options.config.allowStdioServerCreate,
          allowSystemConfigWrite: options.config.allowSystemConfigWrite,
          allowedTargetHosts: options.config.security.allowedTargetHosts,
          forceReadonly: options.forceReadonly ?? options.config.forceReadonly,
        },
        redactor,
      });

      auditLogger.record({
        action: 'http.request',
        actor: auth.actor,
        profile: requestedProfile,
        target: `${request.method ?? 'UNKNOWN'} ${pathname}`,
        ...(auth.upstreamProfileName !== undefined
          ? { upstreamProfile: auth.upstreamProfileName }
          : {}),
      });

      response.on('close', () => {
        void transport.close();
        void mcpServer.close();
      });

      await mcpServer.connect(transport as never);
      await transport.handleRequest(request, response, parsedBody);
    } catch (error) {
      logger.error('Failed to handle streamable HTTP request.', {
        error: error instanceof Error ? error.message : String(error),
        path: pathname,
      });

      if (!response.headersSent) {
        writeJson(response, 500, { error: 'Internal server error.' });
      } else {
        response.end();
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Failed to resolve HTTP server address.');
  }

  logger.info('http transport started', {
    host,
    port: address.port,
  });

  return {
    close: async () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error !== undefined) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
    port: address.port,
    server,
  };
}
