import { afterEach, describe, expect, it } from 'vitest';

import { createRealClient, getRealTestEnvironment, requireRealSuite } from '../helpers/real-env.js';

const realEnv = getRealTestEnvironment();
const describeReal = realEnv.mutationEnabled || realEnv.releaseRequired ? describe : describe.skip;

type FixtureGroup = {
  groupId: string;
};

async function findGroupByName(client: ReturnType<typeof createRealClient>, name: string): Promise<FixtureGroup | undefined> {
  const groups = await client.groups.list();
  const group = groups.find((candidate) => {
    return 'name' in candidate && candidate.name === name && 'id' in candidate && typeof candidate.id === 'string';
  });

  if (group === undefined || !('id' in group) || typeof group.id !== 'string') {
    return undefined;
  }

  return {
    groupId: group.id,
  };
}

describeReal('real mutation suite', () => {
  const createdGroupIds = new Set<string>();

  afterEach(async () => {
    if (createdGroupIds.size === 0) {
      return;
    }

    const client = createRealClient(realEnv);
    for (const groupId of createdGroupIds) {
      try {
        await client.groups.delete(groupId);
      } catch {
        // Best-effort cleanup so that the explicit cleanup script can remove leftovers later.
      }
    }
    createdGroupIds.clear();
  });

  it('creates and deletes a namespaced fixture group', async () => {
    requireRealSuite(realEnv, 'mutation');

    const client = createRealClient(realEnv);
    const fixtureName = `${realEnv.fixturePrefix}-${String(Date.now())}`;

    const existing = await findGroupByName(client, fixtureName);
    if (existing !== undefined) {
      await client.groups.delete(existing.groupId);
    }

    const created = await client.groups.create({
      description: 'Ephemeral fixture group created by the mcp-mcphub real mutation suite.',
      name: fixtureName,
    });

    expect(created).toBeTruthy();

    const resolved = await findGroupByName(client, fixtureName);
    expect(resolved).toBeDefined();
    expect(resolved?.groupId).toBeTruthy();

    if (resolved !== undefined) {
      createdGroupIds.add(resolved.groupId);
      await client.groups.delete(resolved.groupId);
      createdGroupIds.delete(resolved.groupId);
    }

    const deleted = await findGroupByName(client, fixtureName);
    expect(deleted).toBeUndefined();
  });
});
