import { createServer } from 'node:net';
import { spawn } from 'node:child_process';

export type ProcessResult = {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stderr: string;
  stdout: string;
};

export type SpawnedProcess = {
  child: ReturnType<typeof spawn>;
  wait: () => Promise<ProcessResult>;
};

export function spawnProcess(
  command: string,
  args: string[],
  options: {
    cwd?: string | undefined;
    env?: NodeJS.ProcessEnv | undefined;
  } = {},
): SpawnedProcess {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  child.stdout?.setEncoding('utf8');
  child.stdout?.on('data', (chunk: string) => {
    stdout += chunk;
  });

  child.stderr?.setEncoding('utf8');
  child.stderr?.on('data', (chunk: string) => {
    stderr += chunk;
  });

  return {
    child,
    wait: async () =>
      new Promise<ProcessResult>((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', (exitCode, signal) => {
          resolve({
            exitCode,
            signal,
            stderr,
            stdout,
          });
        });
      }),
  };
}

export async function runProcess(
  command: string,
  args: string[],
  options: {
    cwd?: string | undefined;
    env?: NodeJS.ProcessEnv | undefined;
  } = {},
): Promise<ProcessResult> {
  return spawnProcess(command, args, options).wait();
}

export async function waitForHttpHealth(
  url: string,
  timeoutMs = 15_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'health endpoint did not answer';

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }

      lastError = `HTTP ${String(response.status)}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

export async function getFreePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to allocate a free port.')));
        return;
      }

      const port = address.port;
      server.close((error) => {
        if (error !== undefined) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

export async function stopSpawnedProcess(child: ReturnType<typeof spawn>): Promise<void> {
  if (child.exitCode !== null || child.killed) {
    return;
  }

  child.kill();
  await new Promise<void>((resolve) => {
    child.once('exit', () => resolve());
  });
}
