import { createServer } from 'node:http';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterEach, describe, expect, it } from 'vitest';

const tsxCliPath = path.resolve('node_modules/tsx/dist/cli.mjs');
const cliEntryPath = path.resolve('src/cli/bin.ts');
const workspaceRootPath = path.resolve('..');

async function startUpstreamStub() {
  const server = createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (request.method === 'GET' && request.url === '/api/logs') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify([{ level: 'info', message: 'upstream log line' }]));
      return;
    }

    if (request.method === 'GET' && request.url === '/api/settings') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ token: 'secret-token', mode: 'safe' }));
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

describe('stdio transport', () => {
  const cleanup: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanup.length > 0) {
      const task = cleanup.pop();
      if (task !== undefined) {
        await task();
      }
    }
  });

  it('fails fast when MCPHub connection env is missing', () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'mcphub-stdio-empty-'));
    const emptyConfigPath = path.join(tempDir, 'empty.env');
    writeFileSync(emptyConfigPath, '', 'utf8');

    const result = spawnSync(
      process.execPath,
      [tsxCliPath, cliEntryPath, 'stdio', '--config', emptyConfigPath],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          PATH: process.env.PATH ?? '',
          SystemRoot: process.env.SystemRoot ?? '',
        },
        timeout: 5_000,
      },
    );
    rmSync(tempDir, { force: true, recursive: true });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Failed to start stdio transport');
  }, 15_000);

  it('initializes, lists tools, and calls a safe tool over stdio', async () => {
    const upstream = await startUpstreamStub();
    cleanup.push(upstream.close);

    const transport = new StdioClientTransport({
      args: [tsxCliPath, cliEntryPath, 'stdio', '--exposure=safe'],
      command: process.execPath,
      cwd: process.cwd(),
      env: {
        MCPHUB_TOKEN: 'test-token',
        MCPHUB_URL: upstream.url,
        PATH: process.env.PATH ?? '',
        SystemRoot: process.env.SystemRoot ?? '',
      },
      stderr: 'pipe',
    });
    const client = new Client({
      name: 'stdio-smoke-test',
      version: '1.0.0',
    });

    await client.connect(transport);
    cleanup.push(() => client.close());
    cleanup.push(() => transport.close());

    const listedTools = await client.listTools();
    const healthTool = listedTools.tools.find((tool) => tool.name === 'mcphub_health_check');

    expect(healthTool).toBeDefined();
    expect(healthTool?.annotations?.readOnlyHint).toBe(true);

    const listedResources = await client.listResources();
    expect(listedResources.resources.map((resource) => resource.uri)).toEqual(
      expect.arrayContaining(['mcphub://logs/stream', 'mcphub://settings/snapshot']),
    );

    const logsResource = await client.readResource({ uri: 'mcphub://logs/stream' });
    expect(
      logsResource.contents[0] && 'text' in logsResource.contents[0]
        ? logsResource.contents[0].text
        : '',
    ).toContain('upstream log line');

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

  it('supports readonly mode on elevated exposures', async () => {
    const upstream = await startUpstreamStub();
    cleanup.push(upstream.close);

    const transport = new StdioClientTransport({
      args: [tsxCliPath, cliEntryPath, 'stdio', '--exposure=admin', '--readonly'],
      command: process.execPath,
      cwd: process.cwd(),
      env: {
        MCPHUB_TOKEN: 'test-token',
        MCPHUB_URL: upstream.url,
        PATH: process.env.PATH ?? '',
        SystemRoot: process.env.SystemRoot ?? '',
      },
      stderr: 'pipe',
    });
    const client = new Client({
      name: 'stdio-readonly-test',
      version: '1.0.0',
    });

    await client.connect(transport);
    cleanup.push(() => client.close());
    cleanup.push(() => transport.close());

    const listedTools = await client.listTools();
    expect(listedTools.tools.find((tool) => tool.name === 'mcphub_create_server')).toBeUndefined();
    expect(listedTools.tools.find((tool) => tool.name === 'mcphub_health_check')).toBeDefined();
  });

  it('connects over stdio even when launched from the workspace root cwd', async () => {
    const transport = new StdioClientTransport({
      args: [tsxCliPath, cliEntryPath, 'stdio', '--exposure=admin'],
      command: process.execPath,
      cwd: workspaceRootPath,
      env: {
        MCPHUB_TOKEN: 'test-token',
        MCPHUB_URL: 'https://mcphub-site.example.com',
        PATH: process.env.PATH ?? '',
        SystemRoot: process.env.SystemRoot ?? '',
      },
      stderr: 'pipe',
    });
    const client = new Client({
      name: 'stdio-workspace-root-test',
      version: '1.0.0',
    });

    await client.connect(transport);
    cleanup.push(() => client.close());
    cleanup.push(() => transport.close());

    const listedTools = await client.listTools();
    expect(listedTools.tools.length).toBeGreaterThan(0);
  });
});
