// SPDX-License-Identifier: Apache-2.0

import { PACKAGE_METADATA } from '../../version.js';
import type { CliContext, CliResult } from '../types.js';

export function formatVersionOutput(): string {
  return `${PACKAGE_METADATA.name} ${PACKAGE_METADATA.version}`;
}

export function runVersionCommand(context: CliContext): CliResult {
  context.io.stdout.write(`${formatVersionOutput()}\n`);
  return { exitCode: 0 };
}
