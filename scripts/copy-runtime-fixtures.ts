// SPDX-License-Identifier: Apache-2.0

import { cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';

function main(): void {
  const sourceDirectory = path.resolve('tests/fixtures/routes-snapshot');
  const targetDirectory = path.resolve('dist/fixtures/routes-snapshot');

  mkdirSync(targetDirectory, { recursive: true });
  cpSync(sourceDirectory, targetDirectory, { recursive: true });
  process.stdout.write(`Copied runtime fixtures to ${targetDirectory}.\n`);
}

main();
