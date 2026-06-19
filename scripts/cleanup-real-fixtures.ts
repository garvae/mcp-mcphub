// SPDX-License-Identifier: Apache-2.0

import { getRealTestEnvironment, createRealClient } from '../tests/helpers/real-env.js';

async function main(): Promise<void> {
  const realEnv = getRealTestEnvironment();
  if (realEnv.url.length === 0 || realEnv.token.length === 0) {
    process.stdout.write(
      'Skipping cleanup: REAL_TEST_MCPHUB_URL/REAL_TEST_MCPHUB_TOKEN are not configured.\n',
    );
    return;
  }

  const client = createRealClient(realEnv);
  const groups = await client.groups.list();
  const prefix = realEnv.fixturePrefix;
  let deleted = 0;

  for (const group of groups) {
    const candidateName =
      'name' in group && typeof group.name === 'string' ? group.name : undefined;
    const candidateId = 'id' in group && typeof group.id === 'string' ? group.id : undefined;
    if (
      candidateName === undefined ||
      candidateId === undefined ||
      !candidateName.startsWith(prefix)
    ) {
      continue;
    }

    await client.groups.delete(candidateId);
    deleted += 1;
  }

  process.stdout.write(`Removed ${String(deleted)} fixture group(s) with prefix "${prefix}".\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = 1;
});
