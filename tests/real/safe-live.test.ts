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

describeReal('real safe tool suite', () => {
  const cleanup: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanup.length > 0) {
      const task = cleanup.pop();
      if (task !== undefined) {
        await task();
      }
    }
  });

  it('calls core safe tools against the real MCPHub instance', async () => {
    requireRealSuite(realEnv, 'readonly');

    const config = loadConfig(
      createRealRuntimeEnv(realEnv, {
        MCP_HTTP_ALLOWED_ORIGINS: 'https://real-tests.example',
      }),
    );
    const started = await startHttpServer({
      config,
      logger: createSilentLogger(),
      port: 0,
    });
    cleanup.push(started.close);

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
      name: 'real-safe-tool-client',
      version: '1.0.0',
    });

    await client.connect(transport as never);
    cleanup.push(() => client.close());
    cleanup.push(() => transport.close());

    const health = await client.callTool({ name: 'mcphub_health_check' });
    expect(health.structuredContent).toMatchObject({
      meta: { toolName: 'mcphub_health_check' },
    });

    const publicConfig = await client.callTool({ name: 'mcphub_get_public_config' });
    expect(publicConfig.structuredContent).toMatchObject({
      meta: { toolName: 'mcphub_get_public_config' },
    });

    const settingsSnapshot = await client.callTool({ name: 'mcphub_get_settings_snapshot' });
    expect(settingsSnapshot.structuredContent).toMatchObject({
      meta: { toolName: 'mcphub_get_settings_snapshot' },
    });

    const currentUser = await client.callTool({ name: 'mcphub_get_current_user' });
    if (currentUser.structuredContent !== undefined) {
      expect(currentUser.structuredContent).toMatchObject({
        meta: { toolName: 'mcphub_get_current_user' },
      });
    } else {
      expect(currentUser.isError).toBe(true);
    }
  });
});
