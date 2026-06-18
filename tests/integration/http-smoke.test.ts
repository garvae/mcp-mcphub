import { createServer, request as httpRequest } from 'node:http';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterEach, describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config/env.js';
import { startHttpServer } from '../../src/transports/http/server.js';

const MODERN_PROTOCOL_VERSION = '2026-07-28';

async function startUpstreamStub() {
  return startNamedUpstreamStub('ok');
}

async function startNamedUpstreamStub(status: string) {
  const server = createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status }));
      return;
    }

    if (request.method === 'GET' && request.url === '/api/logs') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify([{ level: 'info', message: `${status}-log-line` }]));
      return;
    }

    if (request.method === 'GET' && request.url === '/api/settings') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ mode: status, token: 'secret-token' }));
      return;
    }

    if (request.method === 'GET' && request.url === '/api/better-auth/user') {
      if (request.headers.cookie === 'session=good') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ email: 'user@example.com', username: 'better-auth-user' }));
        return;
      }

      response.writeHead(401, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ message: 'unauthorized' }));
      return;
    }

    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ message: 'not found' }));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Failed to resolve upstream stub address.');
  }

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
    url: `http://127.0.0.1:${String(address.port)}`,
  };
}

async function startIntrospectionStub() {
  const server = createServer(async (request, response) => {
    if (request.method === 'POST' && request.url === '/introspect') {
      const bodyChunks: Buffer[] = [];
      for await (const chunk of request) {
        bodyChunks.push(Buffer.from(chunk as string | Uint8Array));
      }

      const params = new URLSearchParams(Buffer.concat(bodyChunks).toString('utf8'));
      const token = params.get('token');
      if (token === 'oauth-good-token') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            active: true,
            scope: 'mcphub:admin mcphub:safe',
            username: 'oauth-user',
          }),
        );
        return;
      }

      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ active: false }));
      return;
    }

    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ message: 'not found' }));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Failed to resolve introspection stub address.');
  }

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
    url: `http://127.0.0.1:${String(address.port)}/introspect`,
  };
}

function createHttpConfig(upstreamUrl: string) {
  return loadConfig({
    MCPHUB_TOKEN: 'upstream-token',
    MCPHUB_URL: upstreamUrl,
    MCP_HTTP_ALLOWED_HOSTS: '127.0.0.1,localhost',
    MCP_HTTP_ALLOWED_ORIGINS: 'https://allowed.example',
    MCP_HTTP_AUTH_TOKENS_JSON: JSON.stringify({
      'admin-token': 'admin',
      'safe-token': 'safe',
    }),
    MCP_HTTP_HOST: '127.0.0.1',
    MCP_HTTP_PORT: '0',
  });
}

function createMultiProfileHttpConfig(primaryUrl: string, stagingUrl: string) {
  return loadConfig({
    MCPHUB_DEFAULT_PROFILE: 'primary',
    MCPHUB_PROFILES_JSON: JSON.stringify({
      primary: {
        token: 'primary-token',
        tokenKind: 'bearer',
        url: primaryUrl,
      },
      staging: {
        token: 'staging-token',
        tokenKind: 'bearer',
        url: stagingUrl,
      },
    }),
    MCP_HTTP_ALLOWED_HOSTS: '127.0.0.1,localhost',
    MCP_HTTP_ALLOWED_ORIGINS: 'https://allowed.example',
    MCP_HTTP_AUTH_TOKENS_JSON: JSON.stringify({
      'primary-safe-token': {
        exposureProfile: 'safe',
        upstreamProfileName: 'primary',
      },
      'staging-safe-token': {
        exposureProfile: 'safe',
        upstreamProfileName: 'staging',
      },
    }),
    MCP_HTTP_HOST: '127.0.0.1',
    MCP_HTTP_PORT: '0',
  });
}

function createOAuthHttpConfig(upstreamUrl: string, introspectionUrl: string) {
  return loadConfig({
    MCPHUB_TOKEN: 'upstream-token',
    MCPHUB_URL: upstreamUrl,
    MCP_HTTP_ALLOWED_HOSTS: '127.0.0.1,localhost',
    MCP_HTTP_ALLOWED_ORIGINS: 'https://allowed.example',
    MCP_HTTP_AUTH_MODE: 'oauth',
    MCP_HTTP_HOST: '127.0.0.1',
    MCP_HTTP_OAUTH_EXPOSURE_FALLBACK: 'safe',
    MCP_HTTP_OAUTH_INTROSPECTION_URL: introspectionUrl,
    MCP_HTTP_OAUTH_REQUIRED_SCOPE: 'mcphub:admin',
    MCP_HTTP_PORT: '0',
  });
}

function createBetterAuthHttpConfig(upstreamUrl: string) {
  return loadConfig({
    MCPHUB_TOKEN: 'upstream-token',
    MCPHUB_URL: upstreamUrl,
    MCP_HTTP_ALLOWED_HOSTS: '127.0.0.1,localhost',
    MCP_HTTP_ALLOWED_ORIGINS: 'https://allowed.example',
    MCP_HTTP_AUTH_MODE: 'better-auth',
    MCP_HTTP_BETTER_AUTH_EXPOSURE: 'safe',
    MCP_HTTP_HOST: '127.0.0.1',
    MCP_HTTP_PORT: '0',
  });
}

function createStatelessHttpConfig(upstreamUrl: string) {
  return loadConfig({
    MCPHUB_TOKEN: 'upstream-token',
    MCPHUB_URL: upstreamUrl,
    MCP_HTTP_ALLOWED_HOSTS: '127.0.0.1,localhost',
    MCP_HTTP_ALLOWED_ORIGINS: 'https://allowed.example',
    MCP_HTTP_AUTH_TOKENS_JSON: JSON.stringify({
      'safe-token': 'safe',
    }),
    MCP_HTTP_HOST: '127.0.0.1',
    MCP_HTTP_MODE: 'stateless',
    MCP_HTTP_PORT: '0',
  });
}

function createModernMeta() {
  return {
    'io.modelcontextprotocol/clientCapabilities': {},
    'io.modelcontextprotocol/clientInfo': {
      name: 'modern-http-test-client',
      version: '1.0.0',
    },
    'io.modelcontextprotocol/protocolVersion': MODERN_PROTOCOL_VERSION,
  };
}

async function postModernJson(
  port: number,
  body: Record<string, unknown>,
  headers: Record<string, string>,
): Promise<Response> {
  return fetch(`http://127.0.0.1:${String(port)}/mcp/safe`, {
    body: JSON.stringify(body),
    headers: {
      Accept: 'application/json, text/event-stream',
      Authorization: 'Bearer safe-token',
      'Content-Type': 'application/json',
      Origin: 'https://allowed.example',
      ...headers,
    },
    method: 'POST',
  });
}

describe('streamable http transport', () => {
  const cleanup: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanup.length > 0) {
      const task = cleanup.pop();
      if (task !== undefined) {
        await task();
      }
    }
  });

  it('initializes, lists tools, and calls a safe tool over streamable http', async () => {
    const upstream = await startUpstreamStub();
    cleanup.push(upstream.close);

    const started = await startHttpServer({
      config: createHttpConfig(upstream.url),
      port: 0,
    });
    cleanup.push(started.close);

    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${String(started.port)}/mcp/safe`),
      {
        requestInit: {
          headers: {
            Authorization: 'Bearer safe-token',
          },
        },
      },
    );
    const client = new Client({
      name: 'http-smoke-test',
      version: '1.0.0',
    });

    await client.connect(transport as never);
    cleanup.push(() => client.close());
    cleanup.push(() => transport.close());

    const listedTools = await client.listTools();
    const healthTool = listedTools.tools.find((tool) => tool.name === 'mcphub_health_check');

    expect(healthTool).toBeDefined();

    const result = await client.callTool({ name: 'mcphub_health_check' });

    expect(result.structuredContent).toMatchObject({
      data: { status: 'ok' },
      meta: {
        endpoint: '/health',
        method: 'GET',
        profile: 'safe',
        toolName: 'mcphub_health_check',
      },
    });
  });

  it('rejects unauthorized HTTP requests', async () => {
    const upstream = await startUpstreamStub();
    cleanup.push(upstream.close);

    const started = await startHttpServer({
      config: createHttpConfig(upstream.url),
      port: 0,
    });
    cleanup.push(started.close);

    const response = await fetch(`http://127.0.0.1:${String(started.port)}/mcp/safe`, {
      method: 'POST',
    });

    expect(response.status).toBe(401);
  });

  it('rejects disallowed origins and hosts', async () => {
    const upstream = await startUpstreamStub();
    cleanup.push(upstream.close);

    const started = await startHttpServer({
      config: createHttpConfig(upstream.url),
      port: 0,
    });
    cleanup.push(started.close);

    const originResponse = await fetch(`http://127.0.0.1:${String(started.port)}/mcp/safe`, {
      headers: {
        Authorization: 'Bearer safe-token',
        Origin: 'https://blocked.example',
      },
      method: 'POST',
    });

    expect(originResponse.status).toBe(403);

    const hostResponse = await new Promise<{ body: string; statusCode: number | undefined }>(
      (resolve, reject) => {
        const request = httpRequest(
          {
            headers: {
              Host: 'evil.example',
            },
            host: '127.0.0.1',
            method: 'GET',
            path: '/healthz',
            port: started.port,
          },
          (response) => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', (chunk: string | Buffer) => {
              body += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
            });
            response.on('end', () => {
              resolve({ body, statusCode: response.statusCode });
            });
          },
        );

        request.on('error', reject);
        request.end();
      },
    );

    expect(hostResponse.statusCode).toBe(403);
    expect(hostResponse.body).toContain('Host header is not allowed');
  });

  it('rejects unsupported HTTP verbs in stateful mode', async () => {
    const upstream = await startUpstreamStub();
    cleanup.push(upstream.close);

    const started = await startHttpServer({
      config: createHttpConfig(upstream.url),
      port: 0,
    });
    cleanup.push(started.close);

    const response = await fetch(`http://127.0.0.1:${String(started.port)}/mcp/safe`, {
      headers: {
        Authorization: 'Bearer safe-token',
        Origin: 'https://allowed.example',
      },
      method: 'PUT',
    });

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('DELETE, GET, POST');
  });

  it('enforces the configured rate limit', async () => {
    const upstream = await startUpstreamStub();
    cleanup.push(upstream.close);

    const started = await startHttpServer({
      config: createHttpConfig(upstream.url),
      port: 0,
      rateLimitMaxRequests: 2,
      rateLimitWindowMs: 60_000,
    });
    cleanup.push(started.close);

    const first = await fetch(`http://127.0.0.1:${String(started.port)}/mcp/safe`, {
      headers: {
        Authorization: 'Bearer safe-token',
      },
      method: 'POST',
    });
    const second = await fetch(`http://127.0.0.1:${String(started.port)}/mcp/safe`, {
      headers: {
        Authorization: 'Bearer safe-token',
      },
      method: 'POST',
    });
    const third = await fetch(`http://127.0.0.1:${String(started.port)}/mcp/safe`, {
      headers: {
        Authorization: 'Bearer safe-token',
      },
      method: 'POST',
    });

    expect(first.status).not.toBe(429);
    expect(second.status).not.toBe(429);
    expect(third.status).toBe(429);
  });

  it('routes different HTTP tokens to different upstream MCPHub profiles', async () => {
    const primary = await startNamedUpstreamStub('primary');
    const staging = await startNamedUpstreamStub('staging');
    cleanup.push(primary.close);
    cleanup.push(staging.close);

    const started = await startHttpServer({
      config: createMultiProfileHttpConfig(primary.url, staging.url),
      port: 0,
    });
    cleanup.push(started.close);

    const primaryTransport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${String(started.port)}/mcp/safe`),
      {
        requestInit: {
          headers: {
            Authorization: 'Bearer primary-safe-token',
          },
        },
      },
    );
    const stagingTransport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${String(started.port)}/mcp/safe`),
      {
        requestInit: {
          headers: {
            Authorization: 'Bearer staging-safe-token',
          },
        },
      },
    );

    const primaryClient = new Client({ name: 'primary-client', version: '1.0.0' });
    const stagingClient = new Client({ name: 'staging-client', version: '1.0.0' });

    await primaryClient.connect(primaryTransport as never);
    await stagingClient.connect(stagingTransport as never);
    cleanup.push(() => primaryClient.close());
    cleanup.push(() => stagingClient.close());
    cleanup.push(() => primaryTransport.close());
    cleanup.push(() => stagingTransport.close());

    const primaryResult = await primaryClient.callTool({ name: 'mcphub_health_check' });
    const stagingResult = await stagingClient.callTool({ name: 'mcphub_health_check' });

    expect(primaryResult.structuredContent).toMatchObject({ data: { status: 'primary' } });
    expect(stagingResult.structuredContent).toMatchObject({ data: { status: 'staging' } });
  });

  it('accepts OAuth bearer tokens through introspection', async () => {
    const upstream = await startUpstreamStub();
    const introspection = await startIntrospectionStub();
    cleanup.push(upstream.close);
    cleanup.push(introspection.close);

    const started = await startHttpServer({
      config: createOAuthHttpConfig(upstream.url, introspection.url),
      port: 0,
    });
    cleanup.push(started.close);

    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${String(started.port)}/mcp/safe`),
      {
        requestInit: {
          headers: {
            Authorization: 'Bearer oauth-good-token',
          },
        },
      },
    );
    const client = new Client({
      name: 'oauth-http-smoke-test',
      version: '1.0.0',
    });

    await client.connect(transport as never);
    cleanup.push(() => client.close());
    cleanup.push(() => transport.close());

    const result = await client.callTool({ name: 'mcphub_health_check' });
    expect(result.structuredContent).toMatchObject({ data: { status: 'ok' } });
  });

  it('accepts Better Auth session cookies through the bridge mode', async () => {
    const upstream = await startUpstreamStub();
    cleanup.push(upstream.close);

    const started = await startHttpServer({
      config: createBetterAuthHttpConfig(upstream.url),
      port: 0,
    });
    cleanup.push(started.close);

    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${String(started.port)}/mcp/safe`),
      {
        requestInit: {
          headers: {
            Cookie: 'session=good',
          },
        },
      },
    );
    const client = new Client({
      name: 'better-auth-http-smoke-test',
      version: '1.0.0',
    });

    await client.connect(transport as never);
    cleanup.push(() => client.close());
    cleanup.push(() => transport.close());

    const result = await client.callTool({ name: 'mcphub_health_check' });
    expect(result.structuredContent).toMatchObject({ data: { status: 'ok' } });
  });

  it('serves server/discover in stateless modern HTTP mode', async () => {
    const upstream = await startUpstreamStub();
    cleanup.push(upstream.close);

    const started = await startHttpServer({
      config: createStatelessHttpConfig(upstream.url),
      port: 0,
    });
    cleanup.push(started.close);

    const response = await postModernJson(
      started.port,
      {
        id: 'discover-1',
        jsonrpc: '2.0',
        method: 'server/discover',
        params: {
          _meta: createModernMeta(),
        },
      },
      {
        'MCP-Protocol-Version': MODERN_PROTOCOL_VERSION,
        'Mcp-Method': 'server/discover',
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('mcp-session-id')).toBeNull();

    const payload = (await response.json()) as {
      result: {
        cacheScope: string;
        serverInfo: { name: string; version: string };
        supportedVersions: string[];
        ttlMs: number;
      };
    };

    expect(payload.result.supportedVersions).toEqual([MODERN_PROTOCOL_VERSION]);
    expect(payload.result.serverInfo.name).toBe('mcp-mcphub-safe');
    expect(payload.result.serverInfo.version).toBeTruthy();
    expect(payload.result.cacheScope).toBe('private');
    expect(payload.result.ttlMs).toBeGreaterThan(0);
  });

  it('calls tools and reads resources in stateless modern HTTP mode', async () => {
    const upstream = await startUpstreamStub();
    cleanup.push(upstream.close);

    const started = await startHttpServer({
      config: createStatelessHttpConfig(upstream.url),
      port: 0,
    });
    cleanup.push(started.close);

    const toolResponse = await postModernJson(
      started.port,
      {
        id: 1,
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          _meta: createModernMeta(),
          arguments: {},
          name: 'mcphub_health_check',
        },
      },
      {
        'MCP-Protocol-Version': MODERN_PROTOCOL_VERSION,
        'Mcp-Method': 'tools/call',
        'Mcp-Name': 'mcphub_health_check',
      },
    );

    expect(toolResponse.status).toBe(200);
    const toolPayload = (await toolResponse.json()) as Record<string, unknown>;
    expect(toolPayload).toMatchObject({
      result: {
        structuredContent: {
          data: { status: 'ok' },
        },
      },
    });

    const resourceResponse = await postModernJson(
      started.port,
      {
        id: 2,
        jsonrpc: '2.0',
        method: 'resources/read',
        params: {
          _meta: createModernMeta(),
          uri: 'mcphub://settings/snapshot',
        },
      },
      {
        'MCP-Protocol-Version': MODERN_PROTOCOL_VERSION,
        'Mcp-Method': 'resources/read',
        'Mcp-Name': 'mcphub://settings/snapshot',
      },
    );

    expect(resourceResponse.status).toBe(200);
    const resourcePayload = (await resourceResponse.json()) as Record<string, unknown>;
    const resourceResult = resourcePayload.result as Record<string, unknown>;
    expect(resourceResult.cacheScope).toBe('private');
    expect(Array.isArray(resourceResult.contents)).toBe(true);
    expect(typeof resourceResult.ttlMs).toBe('number');
  });

  it('rejects malformed modern stateless headers and legacy GET probes', async () => {
    const upstream = await startUpstreamStub();
    cleanup.push(upstream.close);

    const started = await startHttpServer({
      config: createStatelessHttpConfig(upstream.url),
      port: 0,
    });
    cleanup.push(started.close);

    const mismatchResponse = await postModernJson(
      started.port,
      {
        id: 3,
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          _meta: createModernMeta(),
          arguments: {},
          name: 'mcphub_health_check',
        },
      },
      {
        'MCP-Protocol-Version': MODERN_PROTOCOL_VERSION,
        'Mcp-Method': 'tools/call',
      },
    );

    expect(mismatchResponse.status).toBe(400);
    expect(await mismatchResponse.json()).toMatchObject({
      error: {
        code: -32001,
      },
    });

    const legacyGetResponse = await fetch(`http://127.0.0.1:${String(started.port)}/mcp/safe`, {
      headers: {
        Authorization: 'Bearer safe-token',
        Origin: 'https://allowed.example',
      },
      method: 'GET',
    });

    expect(legacyGetResponse.status).toBe(405);
  });
});
