import path from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { runProcess } from '../helpers/cli.js';
import {
  createRealRuntimeEnv,
  getRealTestEnvironment,
  requireRealSuite,
} from '../helpers/real-env.js';

const realEnv = getRealTestEnvironment();
const describeReal = realEnv.readonlyEnabled || realEnv.releaseRequired ? describe : describe.skip;
const tsxCliPath = path.resolve('node_modules/tsx/dist/cli.mjs');
const cliEntryPath = path.resolve('src/cli/bin.ts');

describeReal('real doctor suite', () => {
  it('passes doctor --json against the live MCPHub instance', async () => {
    requireRealSuite(realEnv, 'readonly');

    const result = await runProcess(
      process.execPath,
      [tsxCliPath, cliEntryPath, 'doctor', '--json'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          ...createRealRuntimeEnv(realEnv),
        },
      },
    );

    expect(result.exitCode).toBe(0);
    const doctorReport = JSON.parse(result.stdout) as unknown;
    expect(doctorReport).toBeTypeOf('object');
    expect(doctorReport).not.toBeNull();
    if (doctorReport === null || typeof doctorReport !== 'object') {
      throw new Error('Expected doctor --json to return an object.');
    }

    expect('checks' in doctorReport && Array.isArray(doctorReport.checks)).toBe(true);
    expect(
      'profile' in doctorReport &&
        typeof doctorReport.profile === 'object' &&
        doctorReport.profile !== null,
    ).toBe(true);
    if (
      !('profile' in doctorReport) ||
      typeof doctorReport.profile !== 'object' ||
      doctorReport.profile === null
    ) {
      throw new Error('Expected doctor report to include a profile object.');
    }

    expect('tokenKind' in doctorReport.profile ? doctorReport.profile.tokenKind : undefined).toBe(
      realEnv.tokenKind,
    );
    expect('url' in doctorReport.profile ? doctorReport.profile.url : undefined).toBe(realEnv.url);
  });

  it('fails doctor with an invalid upstream token', async () => {
    requireRealSuite(realEnv, 'readonly');

    const result = await runProcess(process.execPath, [tsxCliPath, cliEntryPath, 'doctor'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...createRealRuntimeEnv(realEnv, {
          MCPHUB_TOKEN: `${realEnv.token}-invalid`,
        }),
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Doctor failed:');
  });

  it('loads doctor configuration from an env file passed via --config', async () => {
    requireRealSuite(realEnv, 'readonly');

    const tempDirectory = mkdtempSync(path.join(tmpdir(), 'mcphub-real-doctor-'));
    const configPath = path.join(tempDirectory, 'real.env');

    writeFileSync(
      configPath,
      [
        `MCPHUB_URL=${realEnv.url}`,
        `MCPHUB_TOKEN=${realEnv.token}`,
        `MCPHUB_TOKEN_KIND=${realEnv.tokenKind}`,
        `MCPHUB_AUTH_HEADER=${realEnv.authHeader}`,
      ].join('\n'),
      'utf8',
    );

    try {
      const result = await runProcess(
        process.execPath,
        [tsxCliPath, cliEntryPath, 'doctor', '--json', '--config', configPath],
        {
          cwd: process.cwd(),
          env: {
            PATH: process.env.PATH ?? '',
            SystemRoot: process.env.SystemRoot ?? '',
          },
        },
      );

      expect(result.exitCode).toBe(0);
      const doctorReport = JSON.parse(result.stdout) as unknown;
      expect(doctorReport).toMatchObject({
        configSource: {
          kind: 'config-file',
          path: configPath,
        },
      });
    } finally {
      rmSync(tempDirectory, { force: true, recursive: true });
    }
  });
});
