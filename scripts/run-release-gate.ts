// SPDX-License-Identifier: Apache-2.0

import { execFileSync, spawn } from 'node:child_process';

type Step = {
  command: string;
  args: string[];
  description: string;
  env?: NodeJS.ProcessEnv | undefined;
};

function hasRealReadonlyConfiguration(env: NodeJS.ProcessEnv): boolean {
  return env.RUN_REAL_MCPHUB_TESTS === '1' && (env.REAL_TEST_MCPHUB_URL ?? env.MCPHUB_URL) !== undefined && (env.REAL_TEST_MCPHUB_TOKEN ?? env.MCPHUB_TOKEN) !== undefined;
}

function hasContainerRuntime(): boolean {
  try {
    execFileSync('docker', ['version'], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

async function runStep(step: Step): Promise<void> {
  process.stdout.write(`\n==> ${step.description}\n`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(step.command, step.args, {
      env: {
        ...process.env,
        ...step.env,
      },
      shell: process.platform === 'win32',
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', (exitCode) => {
      if (exitCode === 0) {
        resolve();
        return;
      }

      reject(new Error(`Step failed with exit code ${String(exitCode)}: ${step.description}`));
    });
  });
}

async function main(): Promise<void> {
  const shouldPublish = process.argv.includes('--publish');
  const prepublishOnly = process.argv.includes('--prepublish-only');
  const hasDocker = hasContainerRuntime();
  const compatibilityRequired = process.env.RELEASE_COMPAT_TESTS_REQUIRED === '1';

  if (process.env.SKIP_PREPUBLISH_GATE === '1') {
    process.stdout.write('Skipping prepublish gate because SKIP_PREPUBLISH_GATE=1 was set by the caller.\n');
    return;
  }

  const steps: Step[] = [
    { command: 'pnpm', args: ['docs:compatibility:check'], description: 'Verify compatibility documentation' },
    { command: 'pnpm', args: ['docs:coverage:check'], description: 'Verify coverage documentation and JSON export' },
    { command: 'pnpm', args: ['docs:tools:check'], description: 'Verify generated tool catalogs' },
    { command: 'pnpm', args: ['typecheck'], description: 'Run TypeScript typecheck' },
    { command: 'pnpm', args: ['lint'], description: 'Run ESLint' },
    { command: 'pnpm', args: ['test'], description: 'Run default unit and deterministic suites' },
    { command: 'pnpm', args: ['test:integration'], description: 'Run integration suites' },
    { command: 'pnpm', args: ['test:coverage-matrix'], description: 'Verify route coverage matrix' },
    { command: 'pnpm', args: ['build:clean'], description: 'Build clean distribution artifacts' },
    { command: 'pnpm', args: ['pack:smoke'], description: 'Create package tarball' },
    { command: 'pnpm', args: ['pack:audit'], description: 'Audit package contents' },
    { command: 'pnpm', args: ['exec', 'vitest', 'run', '-c', 'vitest.package.config.ts'], description: 'Validate installed package runtime' },
  ];

  if (hasDocker) {
    steps.splice(7, 0, {
      command: 'pnpm',
      args: ['test:compatibility'],
      description: 'Run Docker compatibility suite',
      env: { RUN_MCPHUB_COMPAT_TESTS: '1' },
    });
  } else if (compatibilityRequired) {
    throw new Error('Docker compatibility tests are required, but no working container runtime was detected.');
  } else {
    process.stdout.write('\n==> Skipping Docker compatibility suite because no working container runtime was detected.\n');
  }

  if (!prepublishOnly) {
    steps.push({
      command: 'pnpm',
      args: ['publish', '--dry-run', '--no-git-checks'],
      description: 'Verify npm publish dry-run',
      env: {
        SKIP_PREPUBLISH_GATE: '1',
      },
    });
  }

  if (hasRealReadonlyConfiguration(process.env) || process.env.RELEASE_REAL_TESTS_REQUIRED === '1') {
    steps.push({
      command: 'pnpm',
      args: ['test:real:readonly'],
      description: 'Run live read-only MCPHub checks',
      env: {
        RUN_REAL_MCPHUB_TESTS: process.env.RUN_REAL_MCPHUB_TESTS ?? '1',
      },
    });
  } else {
    process.stdout.write('\n==> Skipping live read-only MCPHub checks because RUN_REAL_MCPHUB_TESTS/REAL_TEST_* are not configured.\n');
  }

  if (shouldPublish) {
    steps.push({
      command: 'pnpm',
      args: ['publish', '--no-git-checks'],
      description: 'Publish package to npm',
      env: {
        SKIP_PREPUBLISH_GATE: '1',
      },
    });
  }

  for (const step of steps) {
    await runStep(step);
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
