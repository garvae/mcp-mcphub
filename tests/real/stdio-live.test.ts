import path from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterEach, describe, expect, it } from 'vitest';

import { createRealRuntimeEnv, getRealTestEnvironment, requireRealSuite } from '../helpers/real-env.js';

const realEnv = getRealTestEnvironment();
const describeReal = realEnv.readonlyEnabled || realEnv.releaseRequired ? describe : describe.skip;
const tsxCliPath = path.resolve('node_modules/tsx/dist/cli.mjs');
const cliEntryPath = path.resolve('src/cli/bin.ts');

describeReal('real stdio transport', () => {
  const cleanup: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanup.length > 0) {
      const task = cleanup.pop();
      if (task !== undefined) {
        await task();
      }
    }
  });

  it('lists safe tools and keeps destructive tools hidden on safe exposure', async () => {
    requireRealSuite(realEnv, 'readonly');

    const transport = new StdioClientTransport({
      args: [tsxCliPath, cliEntryPath, 'stdio', '--exposure=safe'],
      command: process.execPath,
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...createRealRuntimeEnv(realEnv),
        PATH: process.env.PATH ?? '',
        SystemRoot: process.env.SystemRoot ?? '',
      },
      stderr: 'pipe',
    });
    const client = new Client({
      name: 'real-stdio-client',
      version: '1.0.0',
    });

    await client.connect(transport);
    cleanup.push(() => client.close());
    cleanup.push(() => transport.close());

    const tools = await client.listTools();
    expect(tools.tools.find((tool) => tool.name === 'mcphub_health_check')).toBeDefined();
    expect(tools.tools.find((tool) => tool.name === 'mcphub_create_server')).toBeUndefined();

    const result = await client.callTool({ name: 'mcphub_health_check' });
    expect(result.structuredContent).toMatchObject({
      meta: {
        endpoint: '/health',
        profile: 'safe',
        toolName: 'mcphub_health_check',
      },
    });
  });
});
