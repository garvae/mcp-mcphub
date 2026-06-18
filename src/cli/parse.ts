// SPDX-License-Identifier: Apache-2.0

import type { CliCommand } from './types.js';

const SUPPORTED_COMMANDS = new Set<CliCommand>(['doctor', 'help', 'http', 'stdio', 'version']);

export function parseCliCommand(args: readonly string[]): CliCommand {
  const firstArg = args[0];

  if (firstArg === undefined) {
    return 'help';
  }

  if (firstArg === '--help' || firstArg === '-h') {
    return 'help';
  }

  if (firstArg === '--version' || firstArg === '-v') {
    return 'version';
  }

  if (SUPPORTED_COMMANDS.has(firstArg as CliCommand)) {
    return firstArg as CliCommand;
  }

  return 'help';
}
