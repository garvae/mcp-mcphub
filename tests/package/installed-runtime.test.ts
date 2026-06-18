import path from 'node:path';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterEach, describe, expect, it } from 'vitest';

import { getFreePort, runProcess, spawnProcess, stopSpawnedProcess, waitForHttpHealth } from '../helpers/cli.js';
import { startManagementUpstreamStub } from '../helpers/upstream-stub.js';

function getPackedArtifactPath() {
  const artifactDirectory = path.resolve('.artifacts');
  const tarballName = readdirSync(artifactDirectory).find((entry) => entry.endsWith('.tgz'));
  if (tarballName === undefined) {
    throw new Error('No package tarball found under .artifacts. Run pnpm pack:smoke first.');
  }

  return path.join(artifactDirectory, tarballName);
}

function createInstallDirectory() {
  return mkdtempSync(path.join(tmpdir(), 'mcphub-package-test-'));
}

async function installTarball(targetDirectory: string, tarballPath: string) {
  writeFileSync(
    path.join(targetDirectory, 'package.json'),
    JSON.stringify({ name: 'mcphub-package-test', private: true, version: '1.0.0' }, null, 2),
    'utf8',
  );

  const install =
    process.platform === 'win32'
      ? await runProcess('cmd.exe', ['/d', '/s', '/c', 'npm', 'install', '--no-package-lock', tarballPath], {
          cwd: targetDirectory,
          env: process.env,
        })
      : await runProcess('npm', ['install', '--no-package-lock', tarballPath], {
          cwd: targetDirectory,
          env: process.env,
        });

  if (install.exitCode !== 0) {
    throw new Error(`Failed to install package tarball.\nSTDOUT:\n${install.stdout}\nSTDERR:\n${install.stderr}`);
  }
}

describe('installed package runtime', () => {
  const cleanup: Array<() => Promise<void> | void> = [];

  afterEach(async () => {
    while (cleanup.length > 0) {
      const task = cleanup.pop();
      if (task !== undefined) {
        await task();
      }
    }
  });

  it('runs version, doctor, stdio, and http from the packed tarball', async () => {
    const upstream = await startManagementUpstreamStub();
    cleanup.push(upstream.close);

    const installDirectory = createInstallDirectory();
    cleanup.push(() => rmSync(installDirectory, { force: true, recursive: true }));

    await installTarball(installDirectory, getPackedArtifactPath());

    const cliPath = path.join(installDirectory, 'node_modules', '@garvae', 'mcp-mcphub', 'dist', 'cli', 'bin.js');
    const httpPort = await getFreePort();
    const envFilePath = path.join(installDirectory, '.env');

    writeFileSync(
      envFilePath,
      [
        `MCPHUB_URL=${upstream.url}`,
        'MCPHUB_TOKEN=test-token',
        'MCPHUB_TOKEN_KIND=bearer',
        'MCPHUB_AUTH_HEADER=Authorization',
        'MCP_HTTP_AUTH_TOKEN=package-safe-token',
        'MCP_HTTP_ALLOWED_HOSTS=127.0.0.1,localhost',
        'MCP_HTTP_ALLOWED_ORIGINS=',
        'MCP_HTTP_HOST=127.0.0.1',
        `MCP_HTTP_PORT=${String(httpPort)}`,
      ].join('\n'),
      'utf8',
    );

    const versionResult = await runProcess(process.execPath, [cliPath, 'version'], {
      cwd: installDirectory,
      env: process.env,
    });
    expect(versionResult.exitCode).toBe(0);
    expect(versionResult.stdout.trim()).toBeTruthy();

    const doctorResult = await runProcess(process.execPath, [cliPath, 'doctor', '--json'], {
      cwd: installDirectory,
      env: process.env,
    });
    expect(doctorResult.exitCode).toBe(0);
    const doctorReport = JSON.parse(doctorResult.stdout) as unknown;
    expect(doctorReport).toBeTypeOf('object');
    expect(doctorReport).not.toBeNull();
    if (doctorReport === null || typeof doctorReport !== 'object') {
      throw new Error('Expected doctor --json to return an object.');
    }

    expect('checks' in doctorReport && Array.isArray(doctorReport.checks)).toBe(true);
    expect('profile' in doctorReport && typeof doctorReport.profile === 'object' && doctorReport.profile !== null).toBe(true);
    if (!('profile' in doctorReport) || typeof doctorReport.profile !== 'object' || doctorReport.profile === null) {
      throw new Error('Expected doctor report to include a profile object.');
    }

    expect('tokenKind' in doctorReport.profile ? doctorReport.profile.tokenKind : undefined).toBe('bearer');
    expect('url' in doctorReport.profile ? doctorReport.profile.url : undefined).toBe(upstream.url);

    const stdioTransport = new StdioClientTransport({
      args: [cliPath, 'stdio', '--exposure=safe'],
      command: process.execPath,
      cwd: installDirectory,
      env: {
        ...process.env,
        PATH: process.env.PATH ?? '',
        SystemRoot: process.env.SystemRoot ?? '',
      },
      stderr: 'pipe',
    });
    const stdioClient = new Client({ name: 'package-stdio-test', version: '1.0.0' });
    await stdioClient.connect(stdioTransport);
    cleanup.push(() => stdioClient.close());
    cleanup.push(() => stdioTransport.close());

    const tools = await stdioClient.listTools();
    expect(tools.tools.find((tool) => tool.name === 'mcphub_health_check')).toBeDefined();

    const httpServer = spawnProcess(process.execPath, [cliPath, 'http'], {
      cwd: installDirectory,
      env: {
        ...process.env,
        PATH: process.env.PATH ?? '',
        SystemRoot: process.env.SystemRoot ?? '',
      },
    });
    cleanup.push(() => stopSpawnedProcess(httpServer.child));

    await waitForHttpHealth(`http://127.0.0.1:${String(httpPort)}/healthz`);

    const unauthorized = await fetch(`http://127.0.0.1:${String(httpPort)}/mcp/safe`, {
      method: 'POST',
    });
    expect(unauthorized.status).toBe(401);

    const healthz = await fetch(`http://127.0.0.1:${String(httpPort)}/healthz`);
    expect(healthz.status).toBe(200);
  });
});
