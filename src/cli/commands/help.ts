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

export function runHelpCommand(context: CliContext): CliResult {
  context.io.stdout.write(`${formatHelpOutput()}\n`);
  return { exitCode: 0 };
}
