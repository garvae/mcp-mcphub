#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import { runDoctorCommand } from './commands/doctor.js';
import { runHelpCommand } from './commands/help.js';
import { runHttpCommand } from './commands/http.js';
import { runStdioCommand } from './commands/stdio.js';
import { runVersionCommand } from './commands/version.js';
import { parseCliCommand } from './parse.js';
import type { CliContext, CliHandlerResult, CliResult } from './types.js';

type CommandHandler = (context: CliContext) => CliHandlerResult;

const COMMAND_HANDLERS: Record<string, CommandHandler> = {
  doctor: runDoctorCommand,
  help: runHelpCommand,
  http: runHttpCommand,
  stdio: runStdioCommand,
  version: runVersionCommand,
};

/**
 * Creates a small command dispatcher now so later phases can attach transport and diagnostic
 * commands without rewriting the executable entrypoint.
 */
export function createCliApp(io = { stderr: process.stderr, stdout: process.stdout }) {
  return {
    async run(args: readonly string[]): Promise<CliResult> {
      const command = parseCliCommand(args);
      const handler = COMMAND_HANDLERS[command] ?? runHelpCommand;

      return handler({
        args,
        io,
      });
    },
  };
}

async function main(): Promise<void> {
  const app = createCliApp();
  const result = await app.run(process.argv.slice(2));
  process.exitCode = result.exitCode;
}

void main();
