import { describe, expect, it, vi } from 'vitest';

import { createMcpHubClient } from '../../src/core/mcphub-client/client.js';

type Client = ReturnType<typeof createMcpHubClient>;

type TestCase = {
  expectedBody?: string;
  expectedBodyKind?: 'form-data';
  expectedMethod: 'DELETE' | 'GET' | 'POST' | 'PUT';
  expectedUrl: string;
  invoke: (client: Client) => Promise<unknown>;
  name: string;
  response: unknown;
};

function createClient(fetchMock: typeof fetch) {
  return createMcpHubClient({
    authProvider: {
      canRetryAuth: () => false,
      getHeaders: () => Promise.resolve({ Authorization: 'Bearer x' }),
      invalidate: () => undefined,
    },
    baseUrl: 'https://mcphub-site.com',
    fetchImpl: fetchMock,
    retryAttempts: 0,
    retryBackoffMs: 0,
    timeoutMs: 1000,
  });
}

function createJsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  });
}

function normalizeFetchUrl(input: Parameters<typeof fetch>[0]): URL {
  if (input instanceof URL) {
    return input;
  }

  if (input instanceof Request) {
    return new URL(input.url);
  }

  return new URL(input);
}

function readAuthorizationHeader(
  headers: RequestInit['headers'] | undefined,
): string | null | undefined {
  if (headers === undefined) {
    return undefined;
  }

  if (headers instanceof Headers) {
    return headers.get('Authorization');
  }

  if (Array.isArray(headers)) {
    for (const [name, value] of headers) {
      if (name === 'Authorization') {
        return value;
      }
    }

    return undefined;
  }

  if (typeof headers === 'object' && 'Authorization' in headers) {
    const value = headers.Authorization;
    return typeof value === 'string' ? value : undefined;
  }

  return undefined;
}

describe('createMcpHubClient', () => {
  it('validates batch server payload before hitting the transport', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = createClient(fetchMock);

    await expect(client.servers.batchCreate([null])).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts legacy success envelopes from older MCPHub list endpoints', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        createJsonResponse({
          data: [{ id: 'log-1', message: 'hello' }],
          success: true,
        }),
      ),
    );
    const client = createClient(fetchMock);

    await expect(client.logs.list()).resolves.toEqual([{ id: 'log-1', message: 'hello' }]);
  });

  it.each<TestCase>([
    {
      expectedMethod: 'DELETE',
      expectedUrl: 'https://mcphub-site.com/api/activities/cleanup',
      invoke: (client) => client.activities.cleanup(),
      name: 'cleans activities',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/activities/activity-1',
      invoke: (client) => client.activities.get('activity-1'),
      name: 'gets an activity by id',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/activities/filters',
      invoke: (client) => client.activities.getFilters(),
      name: 'gets activity filters',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/activities/stats',
      invoke: (client) => client.activities.getStats(),
      name: 'gets activity stats',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/activities/available',
      invoke: (client) => client.activities.isAvailable(),
      name: 'checks activity availability',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/activities?limit=10&cursor=next',
      invoke: (client) => client.activities.list({ cursor: 'next', limit: 10 }),
      name: 'lists activities with query params',
      response: {},
    },
    {
      expectedBody: JSON.stringify({ currentPassword: 'old', newPassword: 'new' }),
      expectedMethod: 'POST',
      expectedUrl: 'https://mcphub-site.com/api/auth/change-password',
      invoke: (client) =>
        client.auth.changePassword({ currentPassword: 'old', newPassword: 'new' }),
      name: 'changes auth password',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/auth/user',
      invoke: (client) => client.auth.getCurrentUser(),
      name: 'gets current auth user',
      response: {},
    },
    {
      expectedBody: JSON.stringify({ password: 'secret', username: 'owner' }),
      expectedMethod: 'POST',
      expectedUrl: 'https://mcphub-site.com/api/auth/login',
      invoke: (client) => client.auth.login({ password: 'secret', username: 'owner' }),
      name: 'logs in',
      response: {},
    },
    {
      expectedBody: JSON.stringify({ password: 'secret', username: 'owner' }),
      expectedMethod: 'POST',
      expectedUrl: 'https://mcphub-site.com/api/auth/register',
      invoke: (client) => client.auth.register({ password: 'secret', username: 'owner' }),
      name: 'registers a user',
      response: {},
    },
    {
      expectedBody: JSON.stringify({ accessType: 'all', kind: 'system' }),
      expectedMethod: 'POST',
      expectedUrl: 'https://mcphub-site.com/api/auth/keys',
      invoke: (client) => client.bearerKeys.create({ accessType: 'all', kind: 'system' }),
      name: 'creates a bearer key',
      response: {},
    },
    {
      expectedMethod: 'DELETE',
      expectedUrl: 'https://mcphub-site.com/api/auth/keys/key-1',
      invoke: (client) => client.bearerKeys.delete('key-1'),
      name: 'deletes a bearer key',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/auth/keys',
      invoke: (client) => client.bearerKeys.list(),
      name: 'lists bearer keys',
      response: [],
    },
    {
      expectedBody: JSON.stringify({ enabled: false }),
      expectedMethod: 'PUT',
      expectedUrl: 'https://mcphub-site.com/api/auth/keys/key-1',
      invoke: (client) => client.bearerKeys.update('key-1', { enabled: false }),
      name: 'updates a bearer key',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/better-auth/user',
      invoke: (client) => client.betterAuth.getUser(),
      name: 'gets better auth user',
      response: {},
    },
    {
      expectedBody: JSON.stringify({ content: 'Prompt body', name: 'Deploy checklist' }),
      expectedMethod: 'POST',
      expectedUrl: 'https://mcphub-site.com/api/prompts',
      invoke: (client) =>
        client.builtinPrompts.create({ content: 'Prompt body', name: 'Deploy checklist' }),
      name: 'creates a built-in prompt',
      response: {},
    },
    {
      expectedMethod: 'DELETE',
      expectedUrl: 'https://mcphub-site.com/api/prompts/prompt-1',
      invoke: (client) => client.builtinPrompts.delete('prompt-1'),
      name: 'deletes a built-in prompt',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/prompts/prompt-1',
      invoke: (client) => client.builtinPrompts.get('prompt-1'),
      name: 'gets a built-in prompt',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/prompts',
      invoke: (client) => client.builtinPrompts.list(),
      name: 'lists built-in prompts',
      response: [],
    },
    {
      expectedBody: JSON.stringify({ content: 'Updated prompt body' }),
      expectedMethod: 'PUT',
      expectedUrl: 'https://mcphub-site.com/api/prompts/prompt-1',
      invoke: (client) =>
        client.builtinPrompts.update('prompt-1', { content: 'Updated prompt body' }),
      name: 'updates a built-in prompt',
      response: {},
    },
    {
      expectedBody: JSON.stringify({ mimeType: 'text/plain', name: 'Readme' }),
      expectedMethod: 'POST',
      expectedUrl: 'https://mcphub-site.com/api/resources',
      invoke: (client) =>
        client.builtinResources.create({ mimeType: 'text/plain', name: 'Readme' }),
      name: 'creates a built-in resource',
      response: {},
    },
    {
      expectedMethod: 'DELETE',
      expectedUrl: 'https://mcphub-site.com/api/resources/resource-1',
      invoke: (client) => client.builtinResources.delete('resource-1'),
      name: 'deletes a built-in resource',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/resources/resource-1',
      invoke: (client) => client.builtinResources.get('resource-1'),
      name: 'gets a built-in resource',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/resources',
      invoke: (client) => client.builtinResources.list(),
      name: 'lists built-in resources',
      response: [],
    },
    {
      expectedBody: JSON.stringify({ uri: 'file://resource-1' }),
      expectedMethod: 'POST',
      expectedUrl: 'https://mcphub-site.com/api/resources/read',
      invoke: (client) => client.builtinResources.read({ uri: 'file://resource-1' }),
      name: 'reads a built-in resource',
      response: {},
    },
    {
      expectedBody: JSON.stringify({ description: 'Updated resource' }),
      expectedMethod: 'PUT',
      expectedUrl: 'https://mcphub-site.com/api/resources/resource-1',
      invoke: (client) =>
        client.builtinResources.update('resource-1', { description: 'Updated resource' }),
      name: 'updates a built-in resource',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/changelog/update-info',
      invoke: (client) => client.changelog.getUpdateInfo(),
      name: 'gets changelog update info',
      response: {},
    },
    {
      expectedBody: JSON.stringify({ input: { query: 'status' } }),
      expectedMethod: 'POST',
      expectedUrl: 'https://mcphub-site.com/api/cloud/servers/cloud-a/tools/tool-a/call',
      invoke: (client) =>
        client.cloud.callTool('cloud-a', 'tool-a', { input: { query: 'status' } }),
      name: 'calls a cloud tool',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/cloud/categories/devops',
      invoke: (client) => client.cloud.getByCategory('devops'),
      name: 'gets cloud servers by category',
      response: [],
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/cloud/tags/ops',
      invoke: (client) => client.cloud.getByTag('ops'),
      name: 'gets cloud servers by tag',
      response: [],
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/cloud/servers/cloud-a',
      invoke: (client) => client.cloud.getServer('cloud-a'),
      name: 'gets a cloud server',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/cloud/servers/cloud-a/tools',
      invoke: (client) => client.cloud.getTools('cloud-a'),
      name: 'gets cloud server tools',
      response: [],
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/cloud/categories',
      invoke: (client) => client.cloud.listCategories(),
      name: 'lists cloud categories',
      response: [],
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/cloud/servers',
      invoke: (client) => client.cloud.listServers(),
      name: 'lists cloud servers',
      response: [],
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/cloud/tags',
      invoke: (client) => client.cloud.listTags(),
      name: 'lists cloud tags',
      response: [],
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/cloud/servers/search?query=ops',
      invoke: (client) => client.cloud.search('ops'),
      name: 'searches cloud servers',
      response: [],
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/cost/groups',
      invoke: (client) => client.cost.getGroupCosts(),
      name: 'gets group cost data',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/cost/servers',
      invoke: (client) => client.cost.getServerCosts(),
      name: 'gets server cost data',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/discovery/servers/server-a',
      invoke: (client) => client.discovery.getServer('server-a'),
      name: 'gets a discovery server',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/discovery/servers/server-a/install',
      invoke: (client) => client.discovery.getServerInstall('server-a'),
      name: 'gets discovery install instructions',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/discovery/categories',
      invoke: (client) => client.discovery.listCategories(),
      name: 'lists discovery categories',
      response: [],
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/discovery/servers',
      invoke: (client) => client.discovery.listServers(),
      name: 'lists discovery servers',
      response: [],
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/discovery/tags',
      invoke: (client) => client.discovery.listTags(),
      name: 'lists discovery tags',
      response: [],
    },
    {
      expectedBody: JSON.stringify({ serverName: 'server-a' }),
      expectedMethod: 'POST',
      expectedUrl: 'https://mcphub-site.com/api/groups/group-1/servers',
      invoke: (client) => client.groups.addServer('group-1', { serverName: 'server-a' }),
      name: 'adds a server to a group',
      response: {},
    },
    {
      expectedBody: JSON.stringify({ groups: [] }),
      expectedMethod: 'POST',
      expectedUrl: 'https://mcphub-site.com/api/groups/batch',
      invoke: (client) => client.groups.batchCreate({ groups: [] }),
      name: 'batch creates groups',
      response: {},
    },
    {
      expectedBody: JSON.stringify({ name: 'critical' }),
      expectedMethod: 'POST',
      expectedUrl: 'https://mcphub-site.com/api/groups',
      invoke: (client) => client.groups.create({ name: 'critical' }),
      name: 'creates a group',
      response: {},
    },
    {
      expectedMethod: 'DELETE',
      expectedUrl: 'https://mcphub-site.com/api/groups/group-1',
      invoke: (client) => client.groups.delete('group-1'),
      name: 'deletes a group',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/groups/group-1',
      invoke: (client) => client.groups.get('group-1'),
      name: 'gets a group',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/groups/group-1/server-configs/server-a',
      invoke: (client) => client.groups.getServerConfig('group-1', 'server-a'),
      name: 'gets group server config',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/groups/group-1/server-configs',
      invoke: (client) => client.groups.getServerConfigs('group-1'),
      name: 'gets group server configs',
      response: [],
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/groups',
      invoke: (client) => client.groups.list(),
      name: 'lists groups',
      response: [],
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/groups/group-1/servers',
      invoke: (client) => client.groups.listServers('group-1'),
      name: 'lists group servers',
      response: [],
    },
    {
      expectedMethod: 'DELETE',
      expectedUrl: 'https://mcphub-site.com/api/groups/group-1/servers/server-a',
      invoke: (client) => client.groups.removeServer('group-1', 'server-a'),
      name: 'removes a server from a group',
      response: {},
    },
    {
      expectedBody: JSON.stringify({ servers: ['server-a'] }),
      expectedMethod: 'PUT',
      expectedUrl: 'https://mcphub-site.com/api/groups/group-1/servers/batch',
      invoke: (client) => client.groups.replaceServers('group-1', { servers: ['server-a'] }),
      name: 'replaces group servers',
      response: {},
    },
    {
      expectedBody: JSON.stringify({ description: 'Critical services' }),
      expectedMethod: 'PUT',
      expectedUrl: 'https://mcphub-site.com/api/groups/group-1',
      invoke: (client) => client.groups.update('group-1', { description: 'Critical services' }),
      name: 'updates a group',
      response: {},
    },
    {
      expectedBody: JSON.stringify({ tools: ['status'] }),
      expectedMethod: 'PUT',
      expectedUrl: 'https://mcphub-site.com/api/groups/group-1/server-configs/server-a/tools',
      invoke: (client) =>
        client.groups.updateServerTools('group-1', 'server-a', { tools: ['status'] }),
      name: 'updates group server tools',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/health',
      invoke: (client) => client.health.check(),
      name: 'checks health',
      response: { status: 'ok' },
    },
    {
      expectedMethod: 'DELETE',
      expectedUrl: 'https://mcphub-site.com/api/logs',
      invoke: (client) => client.logs.clear(),
      name: 'clears logs',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/logs',
      invoke: (client) => client.logs.list(),
      name: 'lists logs',
      response: [],
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/logs/stream',
      invoke: (client) => client.logs.stream(),
      name: 'streams logs',
      response: { stream: true },
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/market/categories/devops',
      invoke: (client) => client.market.getByCategory('devops'),
      name: 'gets market servers by category',
      response: [],
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/market/tags/ops',
      invoke: (client) => client.market.getByTag('ops'),
      name: 'gets market servers by tag',
      response: [],
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/market/servers/server-a',
      invoke: (client) => client.market.getServer('server-a'),
      name: 'gets a market server',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/market/categories',
      invoke: (client) => client.market.listCategories(),
      name: 'lists market categories',
      response: [],
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/market/servers',
      invoke: (client) => client.market.listServers(),
      name: 'lists market servers',
      response: [],
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/market/tags',
      invoke: (client) => client.market.listTags(),
      name: 'lists market tags',
      response: [],
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/.well-known/mcp-marketplace',
      invoke: (client) => client.marketplace.getWellKnown(),
      name: 'gets marketplace well-known metadata',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/market/servers/search?query=registry',
      invoke: (client) => client.market.search('registry'),
      name: 'searches market servers',
      response: [],
    },
    {
      expectedBodyKind: 'form-data',
      expectedMethod: 'POST',
      expectedUrl: 'https://mcphub-site.com/api/mcpb/upload',
      invoke: (client) => {
        const formData = new FormData();
        formData.set(
          'bundle',
          new Blob(['bundle'], { type: 'application/octet-stream' }),
          'bundle.mcpb',
        );
        return client.mcpb.upload(formData);
      },
      name: 'uploads an MCPB bundle',
      response: {},
    },
    {
      expectedBody: JSON.stringify({ clientName: 'automation' }),
      expectedMethod: 'POST',
      expectedUrl: 'https://mcphub-site.com/api/oauth/clients',
      invoke: (client) => client.oauthClients.create({ clientName: 'automation' }),
      name: 'creates an oauth client',
      response: {},
    },
    {
      expectedMethod: 'DELETE',
      expectedUrl: 'https://mcphub-site.com/api/oauth/clients/client-1',
      invoke: (client) => client.oauthClients.delete('client-1'),
      name: 'deletes an oauth client',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/oauth/clients/client-1',
      invoke: (client) => client.oauthClients.get('client-1'),
      name: 'gets an oauth client',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/oauth/clients',
      invoke: (client) => client.oauthClients.list(),
      name: 'lists oauth clients',
      response: [],
    },
    {
      expectedMethod: 'POST',
      expectedUrl: 'https://mcphub-site.com/api/oauth/clients/client-1/regenerate-secret',
      invoke: (client) => client.oauthClients.regenerateSecret('client-1'),
      name: 'regenerates an oauth client secret',
      response: {},
    },
    {
      expectedBody: JSON.stringify({ redirectUris: ['https://example.com/callback'] }),
      expectedMethod: 'PUT',
      expectedUrl: 'https://mcphub-site.com/api/oauth/clients/client-1',
      invoke: (client) =>
        client.oauthClients.update('client-1', { redirectUris: ['https://example.com/callback'] }),
      name: 'updates an oauth client',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/team-a/openapi.json',
      invoke: (client) => client.openApi.getGroupSpec('team-a'),
      name: 'gets a group downstream openapi spec',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/openapi.json',
      invoke: (client) => client.openApi.getSpec(),
      name: 'gets the downstream openapi spec',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/openapi/stats',
      invoke: (client) => client.openApi.getStats(),
      name: 'gets downstream openapi stats',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/openapi/servers',
      invoke: (client) => client.openApi.listServers(),
      name: 'lists openapi servers',
      response: [],
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/config',
      invoke: (client) => client.publicConfig.getRuntimeConfig(),
      name: 'gets runtime config',
      response: { auth: true },
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/public-config',
      invoke: (client) => client.publicConfig.getSnapshot(),
      name: 'gets public config snapshot',
      response: { auth: true },
    },
    {
      expectedMethod: 'GET',
      expectedUrl:
        'https://mcphub-site.com/api/registry/servers/version?name=server-a&version=1.0.0',
      invoke: (client) => client.registry.getServerVersion({ name: 'server-a', version: '1.0.0' }),
      name: 'gets a registry server version',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/registry/servers/versions?name=server-a',
      invoke: (client) => client.registry.getServerVersions({ name: 'server-a' }),
      name: 'gets registry server versions',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/registry/servers?cursor=next',
      invoke: (client) => client.registry.listServers({ cursor: 'next' }),
      name: 'lists registry servers',
      response: [],
    },
    {
      expectedMethod: 'DELETE',
      expectedUrl: 'https://mcphub-site.com/api/servers/server-a/prompts/prompt-a/description',
      invoke: (client) => client.serverPrompts.resetDescription('server-a', 'prompt-a'),
      name: 'resets a server prompt description',
      response: {},
    },
    {
      expectedMethod: 'POST',
      expectedUrl: 'https://mcphub-site.com/api/servers/server-a/prompts/prompt-a/toggle',
      invoke: (client) => client.serverPrompts.toggle('server-a', 'prompt-a'),
      name: 'toggles a server prompt',
      response: {},
    },
    {
      expectedBody: JSON.stringify({ description: 'Visible prompt' }),
      expectedMethod: 'PUT',
      expectedUrl: 'https://mcphub-site.com/api/servers/server-a/prompts/prompt-a/description',
      invoke: (client) =>
        client.serverPrompts.updateDescription('server-a', 'prompt-a', {
          description: 'Visible prompt',
        }),
      name: 'updates a server prompt description',
      response: {},
    },
    {
      expectedMethod: 'DELETE',
      expectedUrl:
        'https://mcphub-site.com/api/servers/server-a/resources/file%3A%2F%2Fresource-a/description',
      invoke: (client) => client.serverResources.resetDescription('server-a', 'file://resource-a'),
      name: 'resets a server resource description',
      response: {},
    },
    {
      expectedMethod: 'POST',
      expectedUrl:
        'https://mcphub-site.com/api/servers/server-a/resources/file%3A%2F%2Fresource-a/toggle',
      invoke: (client) => client.serverResources.toggle('server-a', 'file://resource-a'),
      name: 'toggles a server resource',
      response: {},
    },
    {
      expectedBody: JSON.stringify({ description: 'Readable resource' }),
      expectedMethod: 'PUT',
      expectedUrl:
        'https://mcphub-site.com/api/servers/server-a/resources/file%3A%2F%2Fresource-a/description',
      invoke: (client) =>
        client.serverResources.updateDescription('server-a', 'file://resource-a', {
          description: 'Readable resource',
        }),
      name: 'updates a server resource description',
      response: {},
    },
    {
      expectedBody: JSON.stringify([{ enabled: true, name: 'server-a' }]),
      expectedMethod: 'POST',
      expectedUrl: 'https://mcphub-site.com/api/servers/batch',
      invoke: (client) => client.servers.batchCreate([{ enabled: true, name: 'server-a' }]),
      name: 'batch creates servers',
      response: {},
    },
    {
      expectedBody: JSON.stringify({ command: 'node', name: 'server-a' }),
      expectedMethod: 'POST',
      expectedUrl: 'https://mcphub-site.com/api/servers',
      invoke: (client) => client.servers.create({ command: 'node', name: 'server-a' }),
      name: 'creates a server',
      response: {},
    },
    {
      expectedMethod: 'DELETE',
      expectedUrl: 'https://mcphub-site.com/api/servers/server-a',
      invoke: (client) => client.servers.delete('server-a'),
      name: 'deletes a server',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/servers/server-a',
      invoke: (client) => client.servers.get('server-a'),
      name: 'gets a server',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/servers',
      invoke: (client) => client.servers.list(),
      name: 'lists servers',
      response: [],
    },
    {
      expectedMethod: 'POST',
      expectedUrl: 'https://mcphub-site.com/api/servers/server-a/reload',
      invoke: (client) => client.servers.reload('server-a'),
      name: 'reloads a server',
      response: {},
    },
    {
      expectedMethod: 'POST',
      expectedUrl: 'https://mcphub-site.com/api/servers/server-a/toggle',
      invoke: (client) => client.servers.toggle('server-a'),
      name: 'toggles a server',
      response: {},
    },
    {
      expectedBody: JSON.stringify({ enabled: false }),
      expectedMethod: 'PUT',
      expectedUrl: 'https://mcphub-site.com/api/servers/server-a',
      invoke: (client) => client.servers.update('server-a', { enabled: false }),
      name: 'updates a server',
      response: {},
    },
    {
      expectedMethod: 'DELETE',
      expectedUrl: 'https://mcphub-site.com/api/servers/server-a/tools/tool-a/description',
      invoke: (client) => client.serverTools.resetDescription('server-a', 'tool-a'),
      name: 'resets a server tool description',
      response: {},
    },
    {
      expectedMethod: 'POST',
      expectedUrl: 'https://mcphub-site.com/api/servers/server-a/tools/tool-a/toggle',
      invoke: (client) => client.serverTools.toggle('server-a', 'tool-a'),
      name: 'toggles a server tool',
      response: {},
    },
    {
      expectedBody: JSON.stringify({ description: 'Visible tool' }),
      expectedMethod: 'PUT',
      expectedUrl: 'https://mcphub-site.com/api/servers/server-a/tools/tool-a/description',
      invoke: (client) =>
        client.serverTools.updateDescription('server-a', 'tool-a', { description: 'Visible tool' }),
      name: 'updates a server tool description',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/mcp-settings/export',
      invoke: (client) => client.settings.export(),
      name: 'exports settings',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/settings',
      invoke: (client) => client.settings.getSnapshot(),
      name: 'gets settings snapshot',
      response: {},
    },
    {
      expectedBody: JSON.stringify({ routing: { skipAuth: false } }),
      expectedMethod: 'PUT',
      expectedUrl: 'https://mcphub-site.com/api/system-config',
      invoke: (client) => client.system.updateConfig({ routing: { skipAuth: false } }),
      name: 'updates system config',
      response: {},
    },
    {
      expectedBody: JSON.stringify({ includeSecrets: false }),
      expectedMethod: 'POST',
      expectedUrl: 'https://mcphub-site.com/api/templates/export',
      invoke: (client) => client.templates.exportConfig({ includeSecrets: false }),
      name: 'exports a config template',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/templates/export/groups/group-1',
      invoke: (client) => client.templates.exportGroup('group-1'),
      name: 'exports a group template',
      response: {},
    },
    {
      expectedBody: JSON.stringify({ dryRun: true, template: {} }),
      expectedMethod: 'POST',
      expectedUrl: 'https://mcphub-site.com/api/templates/import',
      invoke: (client) => client.templates.importConfig({ dryRun: true, template: {} }),
      name: 'imports a config template',
      response: {},
    },
    {
      expectedBody: JSON.stringify({ password: 'secret', username: 'alice' }),
      expectedMethod: 'POST',
      expectedUrl: 'https://mcphub-site.com/api/users',
      invoke: (client) => client.users.create({ password: 'secret', username: 'alice' }),
      name: 'creates a user',
      response: {},
    },
    {
      expectedMethod: 'DELETE',
      expectedUrl: 'https://mcphub-site.com/api/users/alice',
      invoke: (client) => client.users.delete('alice'),
      name: 'deletes a user',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/users/alice',
      invoke: (client) => client.users.get('alice'),
      name: 'gets a user',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/users-stats',
      invoke: (client) => client.users.getStats(),
      name: 'gets user stats',
      response: {},
    },
    {
      expectedMethod: 'GET',
      expectedUrl: 'https://mcphub-site.com/api/users',
      invoke: (client) => client.users.list(),
      name: 'lists users',
      response: [],
    },
    {
      expectedBody: JSON.stringify({ enabled: true }),
      expectedMethod: 'PUT',
      expectedUrl: 'https://mcphub-site.com/api/users/alice',
      invoke: (client) => client.users.update('alice', { enabled: true }),
      name: 'updates a user',
      response: {},
    },
  ])(
    '$name',
    async ({ expectedBody, expectedBodyKind, expectedMethod, expectedUrl, invoke, response }) => {
      let capturedCall: [Parameters<typeof fetch>[0], Parameters<typeof fetch>[1]?] | undefined;
      const fetchMock = vi.fn<typeof fetch>((input, init) => {
        capturedCall = [input, init];
        return Promise.resolve(createJsonResponse(response));
      });
      const client = createClient(fetchMock);

      await invoke(client);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      if (capturedCall === undefined) {
        throw new Error('Expected fetch to be called.');
      }

      const requestUrl: Parameters<typeof fetch>[0] = capturedCall[0];
      const requestInit: RequestInit | undefined = capturedCall[1];
      const actualUrl = normalizeFetchUrl(requestUrl);
      const normalizedExpectedUrl = new URL(expectedUrl);

      expect(actualUrl.origin).toBe(normalizedExpectedUrl.origin);
      expect(actualUrl.pathname).toBe(normalizedExpectedUrl.pathname);
      expect(Array.from(actualUrl.searchParams.entries()).sort()).toEqual(
        Array.from(normalizedExpectedUrl.searchParams.entries()).sort(),
      );
      expect(requestInit?.method).toBe(expectedMethod);
      expect(readAuthorizationHeader(requestInit?.headers)).toBe('Bearer x');

      if (expectedBodyKind === 'form-data') {
        expect(requestInit?.body).toBeInstanceOf(FormData);
      } else if (expectedBody === undefined) {
        expect(requestInit?.body).toBeUndefined();
      } else {
        expect(requestInit?.body).toBe(expectedBody);
      }
    },
  );
});
