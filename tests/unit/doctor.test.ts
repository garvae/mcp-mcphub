import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runDoctorCommand } from '../../src/cli/commands/doctor.js';

class MemoryStream {
  private readonly chunks: string[] = [];

  write(chunk: string): boolean {
    this.chunks.push(chunk);
    return true;
  }

  toString(): string {
    return this.chunks.join('');
  }
}

function clearManagedEnvKey(key: string): void {
  switch (key) {
    case 'ALLOW_AUTH_ADMIN_TOOLS':
      delete process.env.ALLOW_AUTH_ADMIN_TOOLS;
      return;
    case 'ALLOW_SYSTEM_CONFIG_WRITE':
      delete process.env.ALLOW_SYSTEM_CONFIG_WRITE;
      return;
    case 'MCP_HTTP_AUTH_TOKEN':
      delete process.env.MCP_HTTP_AUTH_TOKEN;
      return;
    case 'MCPHUB_TOKEN':
      delete process.env.MCPHUB_TOKEN;
      return;
    case 'MCPHUB_URL':
      delete process.env.MCPHUB_URL;
      return;
    case 'MCP_HTTP_AUTH_TOKENS_JSON':
      delete process.env.MCP_HTTP_AUTH_TOKENS_JSON;
      return;
    case 'MCP_HTTP_HOST':
      delete process.env.MCP_HTTP_HOST;
      return;
    default:
      return;
  }
}

async function startBearerKeyStub() {
  const server = createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/config') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ success: true, data: { version: '1.0.15' } }));
      return;
    }

    if (request.method === 'GET' && request.url === '/api/auth/keys') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify([{ accessType: 'all', kind: 'system', name: 'doctor-key' }]));
      return;
    }

    if (request.method === 'GET' && request.url === '/api/servers') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify([]));
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
    throw new Error('Failed to resolve stub address.');
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

describe('doctor command', () => {
  const cleanup: Array<() => Promise<void>> = [];
  const managedEnvKeys = [
    'ALLOW_AUTH_ADMIN_TOOLS',
    'ALLOW_SYSTEM_CONFIG_WRITE',
    'MCP_HTTP_AUTH_TOKEN',
    'MCPHUB_TOKEN',
    'MCPHUB_URL',
    'MCP_HTTP_AUTH_TOKENS_JSON',
    'MCP_HTTP_HOST',
  ] as const;
  const envBackup = Object.fromEntries(
    managedEnvKeys.map((key) => [key, process.env[key]]),
  ) as Record<(typeof managedEnvKeys)[number], string | undefined>;

  afterEach(async () => {
    for (const key of managedEnvKeys) {
      const originalValue = envBackup[key];
      if (originalValue === undefined) {
        clearManagedEnvKey(key);
      } else {
        process.env[key] = originalValue;
      }
    }

    while (cleanup.length > 0) {
      const task = cleanup.pop();
      if (task !== undefined) {
        await task();
      }
    }
  });

  it('warns on unsafe runtime configuration and validates bearer key visibility', async () => {
    const upstream = await startBearerKeyStub();
    cleanup.push(upstream.close);

    Object.assign(process.env, {
      ALLOW_AUTH_ADMIN_TOOLS: 'true',
      ALLOW_SYSTEM_CONFIG_WRITE: 'true',
      MCPHUB_TOKEN: 'test-token',
      MCPHUB_URL: upstream.url,
      MCP_HTTP_AUTH_TOKENS_JSON: JSON.stringify({ 'safe-token': 'safe' }),
      MCP_HTTP_HOST: '0.0.0.0',
    });

    const stderr = new MemoryStream();
    const result = await runDoctorCommand({
      args: ['doctor'],
      io: {
        stderr: stderr as unknown as NodeJS.WriteStream,
        stdout: stderr as unknown as NodeJS.WriteStream,
      },
    });

    expect(result.exitCode).toBe(0);
    expect(stderr.toString()).toContain('OK: [config_loaded]');
    expect(stderr.toString()).toContain('OK: [credential_accepted]');
    expect(stderr.toString()).toContain('WARN: [recommended_warnings] 4 warning(s) detected.');
    expect(stderr.toString()).toContain('WARN: HTTP host "0.0.0.0" is publicly bound.');
    expect(stderr.toString()).toContain('WARN: ALLOW_AUTH_ADMIN_TOOLS is enabled.');
    expect(stderr.toString()).not.toContain('No system-level all-access bearer key');
  });

  it('auto-loads .env from the current working directory when --config is omitted', async () => {
    const upstream = await startBearerKeyStub();
    cleanup.push(upstream.close);

    const tempDir = mkdtempSync(path.join(tmpdir(), 'mcphub-doctor-'));
    const originalCwd = process.cwd();
    cleanup.push(() => {
      process.chdir(originalCwd);
      rmSync(tempDir, { force: true, recursive: true });
      return Promise.resolve();
    });

    writeFileSync(
      path.join(tempDir, '.env'),
      `MCPHUB_URL=${upstream.url}\nMCPHUB_TOKEN=test-token\nMCP_HTTP_AUTH_TOKENS_JSON={"safe-token":"safe"}\n`,
      'utf8',
    );

    process.chdir(tempDir);

    const stderr = new MemoryStream();
    const result = await runDoctorCommand({
      args: ['doctor'],
      io: {
        stderr: stderr as unknown as NodeJS.WriteStream,
        stdout: stderr as unknown as NodeJS.WriteStream,
      },
    });

    expect(result.exitCode).toBe(0);
    expect(stderr.toString()).toContain('Configuration loaded from');
    expect(stderr.toString()).not.toContain('Doctor failed');
  });

  it('emits structured json output when --json is requested', async () => {
    const upstream = await startBearerKeyStub();
    cleanup.push(upstream.close);

    Object.assign(process.env, {
      MCPHUB_TOKEN: 'test-token',
      MCPHUB_URL: upstream.url,
      MCP_HTTP_AUTH_TOKEN: 'local-safe-token',
    });

    const stdout = new MemoryStream();
    const stderr = new MemoryStream();
    const result = await runDoctorCommand({
      args: ['doctor', '--json'],
      io: {
        stderr: stderr as unknown as NodeJS.WriteStream,
        stdout: stdout as unknown as NodeJS.WriteStream,
      },
    });

    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(stdout.toString()) as {
      checks: Array<{ name: string; status: string }>;
      profile: { tokenKind: string };
    };

    expect(payload.profile.tokenKind).toBe('bearer');
    expect(payload.checks.map((check) => check.name)).toEqual([
      'config_loaded',
      'upstream_reachable',
      'credential_accepted',
      'recommended_warnings',
    ]);
    expect(stderr.toString()).toBe('');
  });
});
