// SPDX-License-Identifier: Apache-2.0

import { PACKAGE_METADATA } from '../../version.js';
import type { CliContext, CliResult } from '../types.js';

export function formatHelpOutput(): string {
  return [
    PACKAGE_METADATA.name,
    '',
    'Usage:',
    '  mcp-mcphub version',
    '  mcp-mcphub stdio',
    '  mcp-mcphub http',
    '  mcp-mcphub doctor',
    '',
    'Doctor flags:',
    '  mcp-mcphub doctor --json',
    '  mcp-mcphub doctor --config .env',
    '  mcp-mcphub doctor --profile primary',
  ].join('\n');
}

export function formatDoctorHelpOutput(): string {
  return [
    'Usage:',
    '  mcp-mcphub doctor',
    '',
    'Flags:',
    '  --help, -h              Show doctor command help',
    '  --json                  Print the doctor report as JSON',
    '  --config <path>         Load variables from a specific env file',
    '  --profile <name>        Use a named MCPHub profile from MCPHUB_PROFILES_JSON',
  ].join('\n');
}

export function runHelpCommand(context: CliContext): CliResult {
  context.io.stdout.write(`${formatHelpOutput()}\n`);
  return { exitCode: 0 };
}
