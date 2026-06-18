// SPDX-License-Identifier: Apache-2.0

import { loadCommandEnv } from '../config-loader.js';
import { loadConfig } from '../../config/env.js';
import { createLogger } from '../../observability/logger.js';
import { startHttpServer } from '../../transports/http/server.js';
import type { CliContext, CliResult } from '../types.js';

type HttpCommandOptions = {
  configPath?: string | undefined;
  forceReadonly: boolean;
  host?: string | undefined;
  mcpHubProfileName?: string | undefined;
  port?: number | undefined;
};

function parseHttpCommandOptions(args: readonly string[]): HttpCommandOptions {
  const options: HttpCommandOptions = {
    forceReadonly: false,
  };

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) {
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

    if (arg === '--host') {
      options.host = args[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith('--host=')) {
      options.host = arg.slice('--host='.length);
      continue;
    }

    if (arg === '--port') {
      const value = args[index + 1];
      options.port = value === undefined ? undefined : Number.parseInt(value, 10);
      index += 1;
      continue;
    }

    if (arg.startsWith('--port=')) {
      options.port = Number.parseInt(arg.slice('--port='.length), 10);
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

    if (arg === '--readonly') {
      options.forceReadonly = true;
    }
  }

  return options;
}

export async function runHttpCommand(context: CliContext): Promise<CliResult> {
  try {
    const options = parseHttpCommandOptions(context.args);
    const mergedEnv = loadCommandEnv(options.configPath, process.env);
    const config = loadConfig(mergedEnv);
    const logger = createLogger(config.logLevel, context.io.stderr);

    await startHttpServer({
      config,
      forceReadonly: options.forceReadonly,
      host: options.host,
      logger,
      mcpHubProfileName: options.mcpHubProfileName,
      port: options.port,
    });

    return { exitCode: 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    context.io.stderr.write(`Failed to start HTTP transport: ${message}\n`);
    return { exitCode: 1 };
  }
}
