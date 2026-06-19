import { Writable } from 'node:stream';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { afterEach, describe, expect, it } from 'vitest';

import {
  getAutomatedCompatibilityTargets,
  type UpstreamCompatibilityTarget,
} from '../../src/core/compatibility/targets.js';
import { loadConfig } from '../../src/config/env.js';
import { createLogger } from '../../src/observability/logger.js';
import { startHttpServer } from '../../src/transports/http/server.js';

const COMPATIBILITY_AUTH_TOKEN = 'compat-safe-token';
const COMPATIBILITY_ORIGIN = 'https://compat.allowed.example';
const COMPATIBILITY_BOOTSTRAP_PASSWORD = 'CompatAdminPassword!2026';
const COMPATIBILITY_FALLBACK_PASSWORD = 'admin123';
const COMPATIBILITY_USERNAME = 'admin';
const COMPATIBILITY_TEST_TIMEOUT_MS = 180_000;
const DOCKER_HTTP_PORT = 3000;

const compatibilityDescribe =
  process.env.RUN_MCPHUB_COMPAT_TESTS === '1' ? describe : describe.skip;

type StartedCompatContainer = {
  container: StartedTestContainer;
  image: string;
  url: string;
};

function createSilentLogger() {
  return createLogger(
    'error',
    new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    }) as NodeJS.WriteStream,
  );
}

function createCompatibilityConfig(upstreamUrl: string) {
  return loadConfig({
    MCPHUB_AUTH_HEADER: 'x-auth-token',
    MCPHUB_PASSWORD: COMPATIBILITY_FALLBACK_PASSWORD,
    MCPHUB_TOKEN_KIND: 'jwt',
    MCPHUB_URL: upstreamUrl,
    MCPHUB_USERNAME: COMPATIBILITY_USERNAME,
    MCP_HTTP_ALLOWED_HOSTS: '127.0.0.1,localhost',
    MCP_HTTP_ALLOWED_ORIGINS: COMPATIBILITY_ORIGIN,
    MCP_HTTP_AUTH_TOKENS_JSON: JSON.stringify({
      [COMPATIBILITY_AUTH_TOKEN]: 'safe',
    }),
    MCP_HTTP_HOST: '127.0.0.1',
    MCP_HTTP_PORT: '0',
  });
}

async function waitForAdminLogin(upstreamUrl: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  let lastError = 'unknown error';
  const candidatePasswords = [COMPATIBILITY_BOOTSTRAP_PASSWORD, COMPATIBILITY_FALLBACK_PASSWORD];

  while (Date.now() < deadline) {
    for (const candidatePassword of candidatePasswords) {
      try {
        const response = await fetch(`${upstreamUrl}/api/auth/login`, {
          body: JSON.stringify({
            password: candidatePassword,
            username: COMPATIBILITY_USERNAME,
          }),
          headers: {
            'content-type': 'application/json',
          },
          method: 'POST',
        });

        const payload = (await response.json()) as { success?: boolean; token?: string };
        if (response.ok && payload.success === true && typeof payload.token === 'string') {
          return;
        }

        lastError = `login probe returned HTTP ${String(response.status)} for candidate password`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out waiting for upstream admin login readiness: ${lastError}`);
}

async function startUpstreamContainer(
  target: UpstreamCompatibilityTarget,
): Promise<StartedCompatContainer> {
  const image = `samanhappy/mcphub:${target.imageTag}`;
  const container = await new GenericContainer(image)
    .withEnvironment({
      ADMIN_PASSWORD: COMPATIBILITY_BOOTSTRAP_PASSWORD,
      DISABLE_WEB: 'true',
      PORT: String(DOCKER_HTTP_PORT),
    })
    .withExposedPorts(DOCKER_HTTP_PORT)
    .withStartupTimeout(120_000)
    .withWaitStrategy(
      Wait.forHttp('/health', DOCKER_HTTP_PORT).forStatusCode(200).withReadTimeout(120_000),
    )
    .start();

  const url = `http://${container.getHost()}:${String(container.getMappedPort(DOCKER_HTTP_PORT))}`;
  await waitForAdminLogin(url);

  return {
    container,
    image,
    url,
  };
}

compatibilityDescribe('upstream MCPHub compatibility', () => {
  const cleanup: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanup.length > 0) {
      const task = cleanup.pop();
      if (task !== undefined) {
        await task();
      }
    }
  });

  for (const target of getAutomatedCompatibilityTargets(process.env.MCPHUB_COMPAT_IMAGE_TAG)) {
    it(
      `smoke-tests ${target.imageTag} through the shared JWT client and MCP transport`,
      async () => {
        const upstream = await startUpstreamContainer(target);
        cleanup.push(async () => {
          await upstream.container.stop();
        });

        const started = await startHttpServer({
          config: createCompatibilityConfig(upstream.url),
          logger: createSilentLogger(),
          port: 0,
        });
        cleanup.push(started.close);

        const transport = new StreamableHTTPClientTransport(
          new URL(`http://127.0.0.1:${String(started.port)}/mcp/safe`),
          {
            requestInit: {
              headers: {
                Authorization: `Bearer ${COMPATIBILITY_AUTH_TOKEN}`,
                Origin: COMPATIBILITY_ORIGIN,
              },
            },
          },
        );
        const client = new Client({
          name: `compatibility-${target.imageTag}`,
          version: '1.0.0',
        });

        await client.connect(transport as never);
        cleanup.push(() => client.close());
        cleanup.push(() => transport.close());

        const listedTools = await client.listTools();
        expect(listedTools.tools.find((tool) => tool.name === 'mcphub_health_check')).toBeDefined();
        expect(
          listedTools.tools.find((tool) => tool.name === 'mcphub_get_current_user'),
        ).toBeDefined();

        const healthResult = await client.callTool({ name: 'mcphub_health_check' });
        expect(healthResult.structuredContent).toMatchObject({
          data: { status: 'healthy' },
          meta: {
            endpoint: '/health',
            method: 'GET',
            profile: 'safe',
            toolName: 'mcphub_health_check',
          },
        });

        const currentUserResult = await client.callTool({ name: 'mcphub_get_current_user' });
        expect(currentUserResult.structuredContent).toMatchObject({
          data: {
            success: true,
            user: {
              isAdmin: true,
              username: COMPATIBILITY_USERNAME,
            },
          },
        });

        const publicConfigResult = await client.callTool({ name: 'mcphub_get_public_config' });
        expect(publicConfigResult.structuredContent).toMatchObject({
          data: {
            success: true,
          },
          meta: {
            endpoint: '/public-config',
            method: 'GET',
            profile: 'safe',
            toolName: 'mcphub_get_public_config',
          },
        });

        const structuredContent = publicConfigResult.structuredContent;
        expect(structuredContent).toBeTypeOf('object');
        expect(structuredContent).not.toBeNull();

        if (
          structuredContent === null ||
          typeof structuredContent !== 'object' ||
          !('data' in structuredContent)
        ) {
          throw new Error('Expected public config tool to return structured content.');
        }

        const publicConfigData = structuredContent.data;
        expect(publicConfigData).toBeTypeOf('object');
        expect(publicConfigData).not.toBeNull();

        if (
          publicConfigData === null ||
          typeof publicConfigData !== 'object' ||
          !('data' in publicConfigData)
        ) {
          throw new Error('Expected public config tool to return a nested data payload.');
        }

        const runtimePublicConfig = publicConfigData.data;
        expect(runtimePublicConfig).toBeTypeOf('object');
        expect(runtimePublicConfig).not.toBeNull();

        if (runtimePublicConfig === null || typeof runtimePublicConfig !== 'object') {
          throw new Error('Expected runtime public config payload to be an object.');
        }

        expect(runtimePublicConfig).toHaveProperty('betterAuth');
        expect(runtimePublicConfig).toHaveProperty('permissions');
        expect(runtimePublicConfig).toHaveProperty('skipAuth', false);
      },
      COMPATIBILITY_TEST_TIMEOUT_MS,
    );
  }
});
