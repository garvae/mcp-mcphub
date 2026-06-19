// SPDX-License-Identifier: Apache-2.0

import { loadCommandEnv } from '../config-loader.js';
import { loadConfig } from '../../config/env.js';
import type { ExposureProfile } from '../../core/coverage/types.js';
import { createLogger } from '../../observability/logger.js';
import { startStdioServer } from '../../transports/stdio/server.js';
import type { CliContext, CliResult } from '../types.js';

type StdioCommandOptions = {
  configPath?: string | undefined;
  exposureProfile?: ExposureProfile | undefined;
  forceReadonly: boolean;
  mcpHubProfileName?: string | undefined;
};

function parseStdioCommandOptions(args: readonly string[]): StdioCommandOptions {
  const options: StdioCommandOptions = {
    forceReadonly: false,
  };

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) {
      continue;
    }

    if (arg === '--exposure') {
      options.exposureProfile = args[index + 1] as ExposureProfile | undefined;
      index += 1;
      continue;
    }

    if (arg.startsWith('--exposure=')) {
      options.exposureProfile = arg.slice('--exposure='.length) as ExposureProfile;
      continue;
    }

    if (arg === '--profile') {
      options.mcpHubProfileName = args[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith('--profile=')) {
      options.mcpHubProfileName = arg.slice('--profile='.length);
      continue;
    }

    if (arg === '--config') {
      options.configPath = args[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith('--config=')) {
      options.configPath = arg.slice('--config='.length);
      continue;
    }

    if (arg === '--readonly') {
      options.forceReadonly = true;
    }
  }

  return options;
}

function installConsoleToStderrShim(stderr: NodeJS.WriteStream) {
  const write = (...values: unknown[]) => {
    stderr.write(
      `${values.map((value) => (typeof value === 'string' ? value : JSON.stringify(value))).join(' ')}\n`,
    );
  };

  console.log = write;
  console.info = write;
  console.warn = write;
  console.error = write;
}

export async function runStdioCommand(context: CliContext): Promise<CliResult> {
  try {
    const options = parseStdioCommandOptions(context.args);
    const mergedEnv = loadCommandEnv(options.configPath, process.env);
    const config = loadConfig(mergedEnv);
    const exposureProfile = options.exposureProfile ?? config.defaultExposure;

    installConsoleToStderrShim(context.io.stderr);

    await startStdioServer({
      config,
      exposureProfile,
      forceReadonly: options.forceReadonly,
      logger: createLogger(config.logLevel, context.io.stderr),
      mcpHubProfileName: options.mcpHubProfileName,
      stderr: context.io.stderr,
    });

    return { exitCode: 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    context.io.stderr.write(`Failed to start stdio transport: ${message}\n`);
    return { exitCode: 1 };
  }
}
