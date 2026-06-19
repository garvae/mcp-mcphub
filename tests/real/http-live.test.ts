import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterEach, describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config/env.js';
import { startHttpServer } from '../../src/transports/http/server.js';
import {
  createRealRuntimeEnv,
  createSilentLogger,
  getRealTestEnvironment,
  requireRealSuite,
} from '../helpers/real-env.js';

const realEnv = getRealTestEnvironment();
const describeReal = realEnv.readonlyEnabled || realEnv.releaseRequired ? describe : describe.skip;

describeReal('real streamable http transport', () => {
  const cleanup: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanup.length > 0) {
      const task = cleanup.pop();
      if (task !== undefined) {
        await task();
      }
    }
  });

  it('accepts the configured HTTP token and rejects invalid tokens', async () => {
    requireRealSuite(realEnv, 'readonly');

    const config = loadConfig(
      createRealRuntimeEnv(realEnv, {
        MCP_HTTP_ALLOWED_ORIGINS: 'https://real-tests.example',
        MCP_HTTP_AUTH_TOKENS_JSON: JSON.stringify({
          [realEnv.httpAuthToken]: 'safe',
        }),
      }),
    );

    const started = await startHttpServer({
      config,
      logger: createSilentLogger(),
      port: 0,
    });
    cleanup.push(started.close);

    const unauthorized = await fetch(`http://127.0.0.1:${String(started.port)}/mcp/safe`, {
      headers: {
        Authorization: 'Bearer definitely-invalid',
        Origin: 'https://real-tests.example',
      },
      method: 'POST',
    });
    expect(unauthorized.status).toBe(401);

    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${String(started.port)}/mcp/safe`),
      {
        requestInit: {
          headers: {
            Authorization: `Bearer ${realEnv.httpAuthToken}`,
            Origin: 'https://real-tests.example',
          },
        },
      },
    );
    const client = new Client({
      name: 'real-http-client',
      version: '1.0.0',
    });

    await client.connect(transport as never);
    cleanup.push(() => client.close());
    cleanup.push(() => transport.close());

    const tools = await client.listTools();
    expect(tools.tools.find((tool) => tool.name === 'mcphub_health_check')).toBeDefined();

    const healthz = await fetch(`http://127.0.0.1:${String(started.port)}/healthz`);
    expect(healthz.status).toBe(200);
  });
});
