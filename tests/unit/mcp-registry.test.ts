import { describe, expect, it } from 'vitest';

import { COVERAGE } from '../../src/core/coverage/matrix.js';
import type { ExposureProfile } from '../../src/core/coverage/types.js';
import {
  createToolRegistry,
  DEFAULT_TOOL_FEATURE_FLAGS,
  listManagedToolsForProfile,
} from '../../src/mcp/registry.js';
import { createManagedMcpServer } from '../../src/mcp/server.js';

type RegistryCase = {
  expectedArgs: unknown[];
  expectedCall: string;
  input: unknown;
  name: string;
  profile: ExposureProfile;
  toolName: string;
};

function listExpectedToolNames(profile: ExposureProfile): string[] {
  const exposureRank: Record<ExposureProfile, number> = {
    safe: 0,
    ops: 1,
    admin: 2,
    all: 3,
  };

  return COVERAGE.filter(
    (entry) =>
      entry.mcp.kind === 'tool' &&
      entry.profile !== null &&
      exposureRank[entry.profile] <= exposureRank[profile],
  )
    .map((entry) => entry.mcp.name ?? '')
    .sort();
}

const allFeatureFlagsEnabled = {
  ...DEFAULT_TOOL_FEATURE_FLAGS,
  allowAuthAdminTools: true,
  allowMcpbUpload: true,
  allowStdioServerCreate: true,
  allowSystemConfigWrite: true,
};

function createRegistryHarness() {
  const calls: Array<{ args: unknown[]; call: string }> = [];

  const record = (call: string, ...args: unknown[]) => {
    calls.push({ args, call });
    return Promise.resolve({ args, call });
  };

  const client = {
    activities: {
      cleanup: () => record('activities.cleanup'),
      get: (id: string) => record('activities.get', id),
      getFilters: () => record('activities.getFilters'),
      getStats: () => record('activities.getStats'),
      isAvailable: () => record('activities.isAvailable'),
      list: (query?: Record<string, unknown>) => record('activities.list', query),
    },
    auth: {
      getCurrentUser: () => record('auth.getCurrentUser'),
    },
    bearerKeys: {
      create: (body: Record<string, unknown>) => record('bearerKeys.create', body),
      delete: (id: string) => record('bearerKeys.delete', id),
      list: () => record('bearerKeys.list'),
      update: (id: string, body: Record<string, unknown>) => record('bearerKeys.update', id, body),
    },
    betterAuth: {
      getUser: () => record('betterAuth.getUser'),
    },
    builtinPrompts: {
      create: (body: Record<string, unknown>) => record('builtinPrompts.create', body),
      delete: (id: string) => record('builtinPrompts.delete', id),
      get: (id: string) => record('builtinPrompts.get', id),
      list: () => record('builtinPrompts.list'),
      update: (id: string, body: Record<string, unknown>) =>
        record('builtinPrompts.update', id, body),
    },
    builtinResources: {
      create: (body: Record<string, unknown>) => record('builtinResources.create', body),
      delete: (id: string) => record('builtinResources.delete', id),
      get: (id: string) => record('builtinResources.get', id),
      list: () => record('builtinResources.list'),
      read: (body: Record<string, unknown>) => record('builtinResources.read', body),
      update: (id: string, body: Record<string, unknown>) =>
        record('builtinResources.update', id, body),
    },
    changelog: {
      getUpdateInfo: () => record('changelog.getUpdateInfo'),
    },
    cloud: {
      callTool: (serverName: string, toolName: string, body: Record<string, unknown>) =>
        record('cloud.callTool', serverName, toolName, body),
      getByCategory: (category: string) => record('cloud.getByCategory', category),
      getByTag: (tag: string) => record('cloud.getByTag', tag),
      getServer: (name: string) => record('cloud.getServer', name),
      getTools: (serverName: string) => record('cloud.getTools', serverName),
      listCategories: () => record('cloud.listCategories'),
      listServers: () => record('cloud.listServers'),
      listTags: () => record('cloud.listTags'),
      search: (query: string) => record('cloud.search', query),
    },
    cost: {
      getGroupCosts: () => record('cost.getGroupCosts'),
      getServerCosts: () => record('cost.getServerCosts'),
    },
    discovery: {
      getServer: (name: string) => record('discovery.getServer', name),
      getServerInstall: (name: string) => record('discovery.getServerInstall', name),
      listCategories: () => record('discovery.listCategories'),
      listServers: () => record('discovery.listServers'),
      listTags: () => record('discovery.listTags'),
    },
    groups: {
      addServer: (groupId: string, body: Record<string, unknown>) =>
        record('groups.addServer', groupId, body),
      batchCreate: (body: Record<string, unknown>) => record('groups.batchCreate', body),
      create: (body: Record<string, unknown>) => record('groups.create', body),
      delete: (groupId: string) => record('groups.delete', groupId),
      get: (groupId: string) => record('groups.get', groupId),
      getServerConfig: (groupId: string, serverName: string) =>
        record('groups.getServerConfig', groupId, serverName),
      getServerConfigs: (groupId: string) => record('groups.getServerConfigs', groupId),
      list: () => record('groups.list'),
      listServers: (groupId: string) => record('groups.listServers', groupId),
      removeServer: (groupId: string, serverName: string) =>
        record('groups.removeServer', groupId, serverName),
      replaceServers: (groupId: string, body: Record<string, unknown>) =>
        record('groups.replaceServers', groupId, body),
      update: (groupId: string, body: Record<string, unknown>) =>
        record('groups.update', groupId, body),
      updateServerTools: (groupId: string, serverName: string, body: Record<string, unknown>) =>
        record('groups.updateServerTools', groupId, serverName, body),
    },
    health: {
      check: () => record('health.check'),
    },
    logs: {
      clear: () => record('logs.clear'),
      list: () => record('logs.list'),
    },
    market: {
      getByCategory: (category: string) => record('market.getByCategory', category),
      getByTag: (tag: string) => record('market.getByTag', tag),
      getServer: (name: string) => record('market.getServer', name),
      listCategories: () => record('market.listCategories'),
      listServers: () => record('market.listServers'),
      listTags: () => record('market.listTags'),
      search: (query: string) => record('market.search', query),
    },
    marketplace: {
      getWellKnown: () => record('marketplace.getWellKnown'),
    },
    mcpb: {
      upload: (formData: FormData) => record('mcpb.upload', (formData.get('bundle') as File).name),
    },
    openApi: {
      getGroupSpec: (name: string) => record('openApi.getGroupSpec', name),
      getSpec: () => record('openApi.getSpec'),
      getStats: () => record('openApi.getStats'),
      listServers: () => record('openApi.listServers'),
    },
    oauthClients: {
      create: (body: Record<string, unknown>) => record('oauthClients.create', body),
      delete: (clientId: string) => record('oauthClients.delete', clientId),
      get: (clientId: string) => record('oauthClients.get', clientId),
      list: () => record('oauthClients.list'),
      regenerateSecret: (clientId: string) => record('oauthClients.regenerateSecret', clientId),
      update: (clientId: string, body: Record<string, unknown>) =>
        record('oauthClients.update', clientId, body),
    },
    publicConfig: {
      getRuntimeConfig: () => record('publicConfig.getRuntimeConfig'),
      getSnapshot: () => record('publicConfig.getSnapshot'),
    },
    registry: {
      getServerVersion: (query: Record<string, unknown>) =>
        record('registry.getServerVersion', query),
      getServerVersions: (query: Record<string, unknown>) =>
        record('registry.getServerVersions', query),
      listServers: (query?: Record<string, unknown>) => record('registry.listServers', query),
    },
    serverPrompts: {
      resetDescription: (serverName: string, promptName: string) =>
        record('serverPrompts.resetDescription', serverName, promptName),
      toggle: (serverName: string, promptName: string) =>
        record('serverPrompts.toggle', serverName, promptName),
      updateDescription: (serverName: string, promptName: string, body: Record<string, unknown>) =>
        record('serverPrompts.updateDescription', serverName, promptName, body),
    },
    serverResources: {
      resetDescription: (serverName: string, resourceUri: string) =>
        record('serverResources.resetDescription', serverName, resourceUri),
      toggle: (serverName: string, resourceUri: string) =>
        record('serverResources.toggle', serverName, resourceUri),
      updateDescription: (serverName: string, resourceUri: string, body: Record<string, unknown>) =>
        record('serverResources.updateDescription', serverName, resourceUri, body),
    },
    servers: {
      batchCreate: (body: unknown[]) => record('servers.batchCreate', body),
      create: (body: Record<string, unknown>) => record('servers.create', body),
      delete: (name: string) => record('servers.delete', name),
      get: (name: string) => record('servers.get', name),
      list: () => record('servers.list'),
      reload: (name: string) => record('servers.reload', name),
      toggle: (name: string) => record('servers.toggle', name),
      update: (name: string, body: Record<string, unknown>) => record('servers.update', name, body),
    },
    serverTools: {
      resetDescription: (serverName: string, toolName: string) =>
        record('serverTools.resetDescription', serverName, toolName),
      toggle: (serverName: string, toolName: string) =>
        record('serverTools.toggle', serverName, toolName),
      updateDescription: (serverName: string, toolName: string, body: Record<string, unknown>) =>
        record('serverTools.updateDescription', serverName, toolName, body),
    },
    settings: {
      export: () =>
        Promise.resolve({
          Authorization: 'Bearer secret-token',
          headers: {
            'x-auth-token': 'jwt-secret',
          },
          nested: {
            token: 'secret-token',
          },
        }),
      getSnapshot: () => record('settings.getSnapshot'),
    },
    system: {
      updateConfig: (body: Record<string, unknown>) => record('system.updateConfig', body),
    },
    templates: {
      exportConfig: (body: Record<string, unknown>) => record('templates.exportConfig', body),
      exportGroup: (groupId: string) => record('templates.exportGroup', groupId),
      importConfig: (body: Record<string, unknown>) => record('templates.importConfig', body),
    },
    users: {
      create: (body: Record<string, unknown>) => record('users.create', body),
      delete: (username: string) => record('users.delete', username),
      get: (username: string) => record('users.get', username),
      list: () => record('users.list'),
      getStats: () => record('users.getStats'),
      update: (username: string, body: Record<string, unknown>) =>
        record('users.update', username, body),
    },
  } as never;

  return {
    calls,
    client,
  };
}

const registryCases: RegistryCase[] = [
  {
    expectedArgs: [],
    expectedCall: 'marketplace.getWellKnown',
    input: undefined,
    name: 'gets marketplace well-known metadata',
    profile: 'safe',
    toolName: 'mcphub_get_marketplace_well_known',
  },
  {
    expectedArgs: ['team-a'],
    expectedCall: 'openApi.getGroupSpec',
    input: { name: 'team-a' },
    name: 'gets a group downstream openapi spec',
    profile: 'safe',
    toolName: 'mcphub_get_group_downstream_openapi_spec',
  },
  {
    expectedArgs: [{ cursor: 'next', limit: 10, search: 'ops' }],
    expectedCall: 'activities.list',
    input: { cursor: 'next', limit: 10, search: 'ops' },
    name: 'lists activities',
    profile: 'safe',
    toolName: 'mcphub_list_activities',
  },
  {
    expectedArgs: ['activity-1'],
    expectedCall: 'activities.get',
    input: { id: 'activity-1' },
    name: 'gets an activity',
    profile: 'safe',
    toolName: 'mcphub_get_activity',
  },
  {
    expectedArgs: [],
    expectedCall: 'activities.isAvailable',
    input: undefined,
    name: 'checks activity availability',
    profile: 'safe',
    toolName: 'mcphub_check_activities_available',
  },
  {
    expectedArgs: [],
    expectedCall: 'activities.getFilters',
    input: undefined,
    name: 'gets activity filters',
    profile: 'safe',
    toolName: 'mcphub_get_activity_filters',
  },
  {
    expectedArgs: [],
    expectedCall: 'activities.getStats',
    input: undefined,
    name: 'gets activity stats',
    profile: 'safe',
    toolName: 'mcphub_get_activity_stats',
  },
  {
    expectedArgs: [],
    expectedCall: 'auth.getCurrentUser',
    input: undefined,
    name: 'gets current user',
    profile: 'safe',
    toolName: 'mcphub_get_current_user',
  },
  {
    expectedArgs: [],
    expectedCall: 'betterAuth.getUser',
    input: undefined,
    name: 'gets better auth user',
    profile: 'safe',
    toolName: 'mcphub_get_better_auth_user',
  },
  {
    expectedArgs: [],
    expectedCall: 'changelog.getUpdateInfo',
    input: undefined,
    name: 'gets changelog update info',
    profile: 'safe',
    toolName: 'mcphub_get_changelog_update_info',
  },
  {
    expectedArgs: [],
    expectedCall: 'cloud.listCategories',
    input: undefined,
    name: 'lists cloud categories',
    profile: 'safe',
    toolName: 'mcphub_list_cloud_categories',
  },
  {
    expectedArgs: ['devops'],
    expectedCall: 'cloud.getByCategory',
    input: { category: 'devops' },
    name: 'gets cloud servers by category',
    profile: 'safe',
    toolName: 'mcphub_get_cloud_servers_by_category',
  },
  {
    expectedArgs: [],
    expectedCall: 'cloud.listServers',
    input: undefined,
    name: 'lists cloud servers',
    profile: 'safe',
    toolName: 'mcphub_list_cloud_servers',
  },
  {
    expectedArgs: ['cloud-a'],
    expectedCall: 'cloud.getServer',
    input: { name: 'cloud-a' },
    name: 'gets a cloud server',
    profile: 'safe',
    toolName: 'mcphub_get_cloud_server',
  },
  {
    expectedArgs: ['cloud-a'],
    expectedCall: 'cloud.getTools',
    input: { serverName: 'cloud-a' },
    name: 'gets cloud server tools',
    profile: 'safe',
    toolName: 'mcphub_get_cloud_server_tools',
  },
  {
    expectedArgs: ['registry'],
    expectedCall: 'cloud.search',
    input: { query: 'registry' },
    name: 'searches cloud servers',
    profile: 'safe',
    toolName: 'mcphub_search_cloud_servers',
  },
  {
    expectedArgs: [],
    expectedCall: 'cloud.listTags',
    input: undefined,
    name: 'lists cloud tags',
    profile: 'safe',
    toolName: 'mcphub_list_cloud_tags',
  },
  {
    expectedArgs: ['ops'],
    expectedCall: 'cloud.getByTag',
    input: { tag: 'ops' },
    name: 'gets cloud servers by tag',
    profile: 'safe',
    toolName: 'mcphub_get_cloud_servers_by_tag',
  },
  {
    expectedArgs: [],
    expectedCall: 'cost.getGroupCosts',
    input: undefined,
    name: 'gets group costs',
    profile: 'safe',
    toolName: 'mcphub_get_group_costs',
  },
  {
    expectedArgs: [],
    expectedCall: 'cost.getServerCosts',
    input: undefined,
    name: 'gets server costs',
    profile: 'safe',
    toolName: 'mcphub_get_server_costs',
  },
  {
    expectedArgs: [],
    expectedCall: 'groups.list',
    input: undefined,
    name: 'lists groups',
    profile: 'safe',
    toolName: 'mcphub_list_groups',
  },
  {
    expectedArgs: ['group-1'],
    expectedCall: 'groups.get',
    input: { groupId: 'group-1' },
    name: 'gets a group',
    profile: 'safe',
    toolName: 'mcphub_get_group',
  },
  {
    expectedArgs: ['group-1'],
    expectedCall: 'groups.getServerConfigs',
    input: { groupId: 'group-1' },
    name: 'gets group server configs',
    profile: 'safe',
    toolName: 'mcphub_get_group_server_configs',
  },
  {
    expectedArgs: ['group-1', 'server-a'],
    expectedCall: 'groups.getServerConfig',
    input: { groupId: 'group-1', serverName: 'server-a' },
    name: 'gets a group server config',
    profile: 'safe',
    toolName: 'mcphub_get_group_server_config',
  },
  {
    expectedArgs: ['group-1', 'server-a', { tools: ['status'] }],
    expectedCall: 'groups.updateServerTools',
    input: { groupId: 'group-1', serverName: 'server-a', tools: ['status'] },
    name: 'updates group server tools',
    profile: 'ops',
    toolName: 'mcphub_update_group_server_tools',
  },
  {
    expectedArgs: ['group-1'],
    expectedCall: 'groups.listServers',
    input: { groupId: 'group-1' },
    name: 'lists group servers',
    profile: 'safe',
    toolName: 'mcphub_list_group_servers',
  },
  {
    expectedArgs: ['group-1', { serverName: 'server-a' }],
    expectedCall: 'groups.addServer',
    input: { groupId: 'group-1', serverName: 'server-a' },
    name: 'adds a server to a group',
    profile: 'ops',
    toolName: 'mcphub_add_server_to_group',
  },
  {
    expectedArgs: ['group-1', 'server-a'],
    expectedCall: 'groups.removeServer',
    input: { groupId: 'group-1', serverName: 'server-a' },
    name: 'removes a server from a group',
    profile: 'ops',
    toolName: 'mcphub_remove_server_from_group',
  },
  {
    expectedArgs: ['group-1', { servers: ['server-a'] }],
    expectedCall: 'groups.replaceServers',
    input: { groupId: 'group-1', servers: ['server-a'] },
    name: 'replaces group servers',
    profile: 'ops',
    toolName: 'mcphub_replace_group_servers',
  },
  {
    expectedArgs: [],
    expectedCall: 'logs.list',
    input: undefined,
    name: 'gets logs',
    profile: 'safe',
    toolName: 'mcphub_get_logs',
  },
  {
    expectedArgs: [],
    expectedCall: 'market.listCategories',
    input: undefined,
    name: 'lists market categories',
    profile: 'safe',
    toolName: 'mcphub_list_market_categories',
  },
  {
    expectedArgs: ['devops'],
    expectedCall: 'market.getByCategory',
    input: { category: 'devops' },
    name: 'gets market servers by category',
    profile: 'safe',
    toolName: 'mcphub_get_market_servers_by_category',
  },
  {
    expectedArgs: [],
    expectedCall: 'market.listServers',
    input: undefined,
    name: 'lists market servers',
    profile: 'safe',
    toolName: 'mcphub_list_market_servers',
  },
  {
    expectedArgs: ['server-a'],
    expectedCall: 'market.getServer',
    input: { name: 'server-a' },
    name: 'gets a market server',
    profile: 'safe',
    toolName: 'mcphub_get_market_server',
  },
  {
    expectedArgs: ['registry'],
    expectedCall: 'market.search',
    input: { query: 'registry' },
    name: 'searches market servers',
    profile: 'safe',
    toolName: 'mcphub_search_market_servers',
  },
  {
    expectedArgs: [],
    expectedCall: 'market.listTags',
    input: undefined,
    name: 'lists market tags',
    profile: 'safe',
    toolName: 'mcphub_list_market_tags',
  },
  {
    expectedArgs: ['ops'],
    expectedCall: 'market.getByTag',
    input: { tag: 'ops' },
    name: 'gets market servers by tag',
    profile: 'safe',
    toolName: 'mcphub_get_market_servers_by_tag',
  },
  {
    expectedArgs: [],
    expectedCall: 'openApi.getSpec',
    input: undefined,
    name: 'gets downstream openapi spec',
    profile: 'safe',
    toolName: 'mcphub_get_downstream_openapi_spec',
  },
  {
    expectedArgs: [],
    expectedCall: 'openApi.listServers',
    input: undefined,
    name: 'lists openapi servers',
    profile: 'safe',
    toolName: 'mcphub_list_openapi_servers',
  },
  {
    expectedArgs: [],
    expectedCall: 'openApi.getStats',
    input: undefined,
    name: 'gets openapi stats',
    profile: 'safe',
    toolName: 'mcphub_get_openapi_stats',
  },
  {
    expectedArgs: [],
    expectedCall: 'builtinPrompts.list',
    input: undefined,
    name: 'lists built-in prompts',
    profile: 'safe',
    toolName: 'mcphub_list_builtin_prompts',
  },
  {
    expectedArgs: ['prompt-1'],
    expectedCall: 'builtinPrompts.get',
    input: { id: 'prompt-1' },
    name: 'gets a built-in prompt',
    profile: 'safe',
    toolName: 'mcphub_get_builtin_prompt',
  },
  {
    expectedArgs: ['prompt-1', { content: 'Updated prompt' }],
    expectedCall: 'builtinPrompts.update',
    input: { content: 'Updated prompt', id: 'prompt-1' },
    name: 'updates a built-in prompt',
    profile: 'ops',
    toolName: 'mcphub_update_builtin_prompt',
  },
  {
    expectedArgs: [{ cursor: 'next', limit: 5, search: 'server' }],
    expectedCall: 'registry.listServers',
    input: { cursor: 'next', limit: 5, search: 'server' },
    name: 'lists registry servers',
    profile: 'safe',
    toolName: 'mcphub_list_registry_servers',
  },
  {
    expectedArgs: [{ name: 'server-a', version: '1.0.0' }],
    expectedCall: 'registry.getServerVersion',
    input: { name: 'server-a', version: '1.0.0' },
    name: 'gets registry server version',
    profile: 'safe',
    toolName: 'mcphub_get_registry_server_version',
  },
  {
    expectedArgs: [{ name: 'server-a' }],
    expectedCall: 'registry.getServerVersions',
    input: { name: 'server-a' },
    name: 'gets registry server versions',
    profile: 'safe',
    toolName: 'mcphub_get_registry_server_versions',
  },
  {
    expectedArgs: [],
    expectedCall: 'builtinResources.list',
    input: undefined,
    name: 'lists built-in resources',
    profile: 'safe',
    toolName: 'mcphub_list_builtin_resources',
  },
  {
    expectedArgs: ['resource-1'],
    expectedCall: 'builtinResources.get',
    input: { id: 'resource-1' },
    name: 'gets a built-in resource',
    profile: 'safe',
    toolName: 'mcphub_get_builtin_resource',
  },
  {
    expectedArgs: ['resource-1', { description: 'Readable resource' }],
    expectedCall: 'builtinResources.update',
    input: { description: 'Readable resource', id: 'resource-1' },
    name: 'updates a built-in resource',
    profile: 'ops',
    toolName: 'mcphub_update_builtin_resource',
  },
  {
    expectedArgs: [{ uri: 'file://resource-1' }],
    expectedCall: 'builtinResources.read',
    input: { uri: 'file://resource-1' },
    name: 'reads a built-in resource',
    profile: 'safe',
    toolName: 'mcphub_read_builtin_resource',
  },
  {
    expectedArgs: [],
    expectedCall: 'servers.list',
    input: undefined,
    name: 'lists servers',
    profile: 'safe',
    toolName: 'mcphub_list_servers',
  },
  {
    expectedArgs: ['server-a'],
    expectedCall: 'servers.get',
    input: { name: 'server-a' },
    name: 'gets a server',
    profile: 'safe',
    toolName: 'mcphub_get_server',
  },
  {
    expectedArgs: ['server-a'],
    expectedCall: 'servers.reload',
    input: { name: 'server-a' },
    name: 'reloads a server',
    profile: 'ops',
    toolName: 'mcphub_reload_server',
  },
  {
    expectedArgs: ['server-a'],
    expectedCall: 'servers.toggle',
    input: { name: 'server-a' },
    name: 'toggles a server',
    profile: 'ops',
    toolName: 'mcphub_toggle_server',
  },
  {
    expectedArgs: ['server-a', 'prompt-a'],
    expectedCall: 'serverPrompts.resetDescription',
    input: { promptName: 'prompt-a', serverName: 'server-a' },
    name: 'resets a server prompt description',
    profile: 'ops',
    toolName: 'mcphub_reset_server_prompt_description',
  },
  {
    expectedArgs: ['server-a', 'prompt-a', { description: 'Visible prompt' }],
    expectedCall: 'serverPrompts.updateDescription',
    input: { description: 'Visible prompt', promptName: 'prompt-a', serverName: 'server-a' },
    name: 'updates a server prompt description',
    profile: 'ops',
    toolName: 'mcphub_update_server_prompt_description',
  },
  {
    expectedArgs: ['server-a', 'prompt-a'],
    expectedCall: 'serverPrompts.toggle',
    input: { promptName: 'prompt-a', serverName: 'server-a' },
    name: 'toggles a server prompt',
    profile: 'ops',
    toolName: 'mcphub_toggle_server_prompt',
  },
  {
    expectedArgs: ['server-a', 'file://resource-a'],
    expectedCall: 'serverResources.resetDescription',
    input: { resourceUri: 'file://resource-a', serverName: 'server-a' },
    name: 'resets a server resource description',
    profile: 'ops',
    toolName: 'mcphub_reset_server_resource_description',
  },
  {
    expectedArgs: ['server-a', 'file://resource-a', { description: 'Readable resource' }],
    expectedCall: 'serverResources.updateDescription',
    input: {
      description: 'Readable resource',
      resourceUri: 'file://resource-a',
      serverName: 'server-a',
    },
    name: 'updates a server resource description',
    profile: 'ops',
    toolName: 'mcphub_update_server_resource_description',
  },
  {
    expectedArgs: ['server-a', 'file://resource-a'],
    expectedCall: 'serverResources.toggle',
    input: { resourceUri: 'file://resource-a', serverName: 'server-a' },
    name: 'toggles a server resource',
    profile: 'ops',
    toolName: 'mcphub_toggle_server_resource',
  },
  {
    expectedArgs: ['server-a', 'tool-a'],
    expectedCall: 'serverTools.resetDescription',
    input: { serverName: 'server-a', toolName: 'tool-a' },
    name: 'resets a server tool description',
    profile: 'ops',
    toolName: 'mcphub_reset_server_tool_description',
  },
  {
    expectedArgs: ['server-a', 'tool-a', { description: 'Visible tool' }],
    expectedCall: 'serverTools.updateDescription',
    input: { description: 'Visible tool', serverName: 'server-a', toolName: 'tool-a' },
    name: 'updates a server tool description',
    profile: 'ops',
    toolName: 'mcphub_update_server_tool_description',
  },
  {
    expectedArgs: ['server-a', 'tool-a'],
    expectedCall: 'serverTools.toggle',
    input: { serverName: 'server-a', toolName: 'tool-a' },
    name: 'toggles a server tool',
    profile: 'ops',
    toolName: 'mcphub_toggle_server_tool',
  },
  {
    expectedArgs: [],
    expectedCall: 'settings.getSnapshot',
    input: undefined,
    name: 'gets settings snapshot',
    profile: 'safe',
    toolName: 'mcphub_get_settings_snapshot',
  },
  {
    expectedArgs: [{ includeSecrets: false }],
    expectedCall: 'templates.exportConfig',
    input: { includeSecrets: false },
    name: 'exports a config template',
    profile: 'ops',
    toolName: 'mcphub_export_config_template',
  },
  {
    expectedArgs: ['group-1'],
    expectedCall: 'templates.exportGroup',
    input: { groupId: 'group-1' },
    name: 'exports a group template',
    profile: 'ops',
    toolName: 'mcphub_export_group_template',
  },
  {
    expectedArgs: [],
    expectedCall: 'users.getStats',
    input: undefined,
    name: 'gets user stats',
    profile: 'safe',
    toolName: 'mcphub_get_user_stats',
  },
  {
    expectedArgs: [],
    expectedCall: 'publicConfig.getRuntimeConfig',
    input: undefined,
    name: 'gets runtime config',
    profile: 'safe',
    toolName: 'mcphub_get_runtime_config',
  },
  {
    expectedArgs: [],
    expectedCall: 'discovery.listCategories',
    input: undefined,
    name: 'lists discovery categories',
    profile: 'safe',
    toolName: 'mcphub_list_discovery_categories',
  },
  {
    expectedArgs: [],
    expectedCall: 'discovery.listServers',
    input: undefined,
    name: 'lists discovery servers',
    profile: 'safe',
    toolName: 'mcphub_list_discovery_servers',
  },
  {
    expectedArgs: ['server-a'],
    expectedCall: 'discovery.getServer',
    input: { name: 'server-a' },
    name: 'gets a discovery server',
    profile: 'safe',
    toolName: 'mcphub_get_discovery_server',
  },
  {
    expectedArgs: ['server-a'],
    expectedCall: 'discovery.getServerInstall',
    input: { name: 'server-a' },
    name: 'gets discovery install info',
    profile: 'safe',
    toolName: 'mcphub_get_discovery_server_install',
  },
  {
    expectedArgs: [],
    expectedCall: 'discovery.listTags',
    input: undefined,
    name: 'lists discovery tags',
    profile: 'safe',
    toolName: 'mcphub_list_discovery_tags',
  },
  {
    expectedArgs: [],
    expectedCall: 'health.check',
    input: undefined,
    name: 'runs health check',
    profile: 'safe',
    toolName: 'mcphub_health_check',
  },
  {
    expectedArgs: [],
    expectedCall: 'publicConfig.getSnapshot',
    input: undefined,
    name: 'gets public config',
    profile: 'safe',
    toolName: 'mcphub_get_public_config',
  },
  {
    expectedArgs: [],
    expectedCall: 'activities.cleanup',
    input: { confirm: true, reason: 'cleanup' },
    name: 'cleans up activities',
    profile: 'admin',
    toolName: 'mcphub_cleanup_activities',
  },
  {
    expectedArgs: [],
    expectedCall: 'bearerKeys.list',
    input: undefined,
    name: 'lists bearer keys',
    profile: 'admin',
    toolName: 'mcphub_list_bearer_keys',
  },
  {
    expectedArgs: [{ accessType: 'all' }],
    expectedCall: 'bearerKeys.create',
    input: { accessType: 'all' },
    name: 'creates a bearer key',
    profile: 'admin',
    toolName: 'mcphub_create_bearer_key',
  },
  {
    expectedArgs: ['key-1'],
    expectedCall: 'bearerKeys.delete',
    input: { confirm: true, expectedId: 'key-1', id: 'key-1', reason: 'rotate' },
    name: 'deletes a bearer key',
    profile: 'admin',
    toolName: 'mcphub_delete_bearer_key',
  },
  {
    expectedArgs: ['key-1', { enabled: false }],
    expectedCall: 'bearerKeys.update',
    input: { body: { enabled: false }, id: 'key-1' },
    name: 'updates a bearer key',
    profile: 'admin',
    toolName: 'mcphub_update_bearer_key',
  },
  {
    expectedArgs: ['cloud-a', 'tool-a', { input: { query: 'status' } }],
    expectedCall: 'cloud.callTool',
    input: { body: { input: { query: 'status' } }, serverName: 'cloud-a', toolName: 'tool-a' },
    name: 'calls a cloud tool',
    profile: 'all',
    toolName: 'mcphub_call_cloud_tool',
  },
  {
    expectedArgs: [{ name: 'critical' }],
    expectedCall: 'groups.create',
    input: { name: 'critical' },
    name: 'creates a group',
    profile: 'admin',
    toolName: 'mcphub_create_group',
  },
  {
    expectedArgs: ['group-1'],
    expectedCall: 'groups.delete',
    input: { confirm: true, expectedGroupId: 'group-1', groupId: 'group-1', reason: 'cleanup' },
    name: 'deletes a group',
    profile: 'admin',
    toolName: 'mcphub_delete_group',
  },
  {
    expectedArgs: ['group-1', { description: 'Critical' }],
    expectedCall: 'groups.update',
    input: { body: { description: 'Critical' }, groupId: 'group-1' },
    name: 'updates a group',
    profile: 'admin',
    toolName: 'mcphub_update_group',
  },
  {
    expectedArgs: [{ groups: [{ name: 'group-a' }] }],
    expectedCall: 'groups.batchCreate',
    input: [{ name: 'group-a' }],
    name: 'batch creates groups',
    profile: 'admin',
    toolName: 'mcphub_batch_create_groups',
  },
  {
    expectedArgs: [],
    expectedCall: 'logs.clear',
    input: { confirm: true, reason: 'cleanup' },
    name: 'clears logs',
    profile: 'admin',
    toolName: 'mcphub_clear_logs',
  },
  {
    expectedArgs: ['bundle.mcpb'],
    expectedCall: 'mcpb.upload',
    input: {
      confirm: true,
      contentBase64: Buffer.from('bundle').toString('base64'),
      filename: 'bundle.mcpb',
      reason: 'deploy',
    },
    name: 'uploads an mcpb bundle',
    profile: 'all',
    toolName: 'mcphub_upload_mcpb_bundle',
  },
  {
    expectedArgs: [],
    expectedCall: 'oauthClients.list',
    input: undefined,
    name: 'lists oauth clients',
    profile: 'admin',
    toolName: 'mcphub_list_oauth_clients',
  },
  {
    expectedArgs: [{ clientName: 'automation' }],
    expectedCall: 'oauthClients.create',
    input: { clientName: 'automation' },
    name: 'creates an oauth client',
    profile: 'admin',
    toolName: 'mcphub_create_oauth_client',
  },
  {
    expectedArgs: ['client-1'],
    expectedCall: 'oauthClients.delete',
    input: { clientId: 'client-1', confirm: true, expectedClientId: 'client-1', reason: 'cleanup' },
    name: 'deletes an oauth client',
    profile: 'admin',
    toolName: 'mcphub_delete_oauth_client',
  },
  {
    expectedArgs: ['client-1'],
    expectedCall: 'oauthClients.get',
    input: { clientId: 'client-1' },
    name: 'gets an oauth client',
    profile: 'admin',
    toolName: 'mcphub_get_oauth_client',
  },
  {
    expectedArgs: ['client-1', { redirectUris: ['https://example.com/callback'] }],
    expectedCall: 'oauthClients.update',
    input: { body: { redirectUris: ['https://example.com/callback'] }, clientId: 'client-1' },
    name: 'updates an oauth client',
    profile: 'admin',
    toolName: 'mcphub_update_oauth_client',
  },
  {
    expectedArgs: ['client-1'],
    expectedCall: 'oauthClients.regenerateSecret',
    input: { clientId: 'client-1', confirm: true, expectedClientId: 'client-1', reason: 'rotate' },
    name: 'regenerates an oauth client secret',
    profile: 'all',
    toolName: 'mcphub_regenerate_oauth_client_secret',
  },
  {
    expectedArgs: [{ content: 'Prompt body' }],
    expectedCall: 'builtinPrompts.create',
    input: { content: 'Prompt body' },
    name: 'creates a built-in prompt',
    profile: 'admin',
    toolName: 'mcphub_create_builtin_prompt',
  },
  {
    expectedArgs: ['prompt-1'],
    expectedCall: 'builtinPrompts.delete',
    input: { confirm: true, expectedId: 'prompt-1', id: 'prompt-1', reason: 'cleanup' },
    name: 'deletes a built-in prompt',
    profile: 'admin',
    toolName: 'mcphub_delete_builtin_prompt',
  },
  {
    expectedArgs: [{ uri: 'file://resource-1' }],
    expectedCall: 'builtinResources.create',
    input: { uri: 'file://resource-1' },
    name: 'creates a built-in resource',
    profile: 'admin',
    toolName: 'mcphub_create_builtin_resource',
  },
  {
    expectedArgs: ['resource-1'],
    expectedCall: 'builtinResources.delete',
    input: { confirm: true, expectedId: 'resource-1', id: 'resource-1', reason: 'cleanup' },
    name: 'deletes a built-in resource',
    profile: 'admin',
    toolName: 'mcphub_delete_builtin_resource',
  },
  {
    expectedArgs: [{ command: 'node', name: 'server-a' }],
    expectedCall: 'servers.create',
    input: { command: 'node', name: 'server-a' },
    name: 'creates a server',
    profile: 'admin',
    toolName: 'mcphub_create_server',
  },
  {
    expectedArgs: ['server-a'],
    expectedCall: 'servers.delete',
    input: { confirm: true, expectedName: 'server-a', name: 'server-a', reason: 'cleanup' },
    name: 'deletes a server',
    profile: 'admin',
    toolName: 'mcphub_delete_server',
  },
  {
    expectedArgs: ['server-a', { enabled: false }],
    expectedCall: 'servers.update',
    input: { body: { enabled: false }, name: 'server-a' },
    name: 'updates a server',
    profile: 'admin',
    toolName: 'mcphub_update_server',
  },
  {
    expectedArgs: [[{ name: 'server-a' }]],
    expectedCall: 'servers.batchCreate',
    input: [{ name: 'server-a' }],
    name: 'batch creates servers',
    profile: 'admin',
    toolName: 'mcphub_batch_create_servers',
  },
  {
    expectedArgs: [{ routing: { skipAuth: false } }],
    expectedCall: 'system.updateConfig',
    input: {
      confirm: true,
      expectedOperation: 'update-system-config',
      reason: 'maintenance',
      routing: { skipAuth: false },
    },
    name: 'updates system config',
    profile: 'all',
    toolName: 'mcphub_update_system_config',
  },
  {
    expectedArgs: [{ template: {} }],
    expectedCall: 'templates.importConfig',
    input: {
      confirm: true,
      expectedOperation: 'import-config-template',
      reason: 'restore',
      template: {},
    },
    name: 'imports a config template',
    profile: 'all',
    toolName: 'mcphub_import_config_template',
  },
  {
    expectedArgs: [],
    expectedCall: 'users.list',
    input: undefined,
    name: 'lists users',
    profile: 'admin',
    toolName: 'mcphub_list_users',
  },
  {
    expectedArgs: [{ username: 'alice' }],
    expectedCall: 'users.create',
    input: { username: 'alice' },
    name: 'creates a user',
    profile: 'admin',
    toolName: 'mcphub_create_user',
  },
  {
    expectedArgs: ['alice'],
    expectedCall: 'users.delete',
    input: { confirm: true, expectedUsername: 'alice', reason: 'cleanup', username: 'alice' },
    name: 'deletes a user',
    profile: 'admin',
    toolName: 'mcphub_delete_user',
  },
  {
    expectedArgs: ['alice'],
    expectedCall: 'users.get',
    input: { username: 'alice' },
    name: 'gets a user',
    profile: 'admin',
    toolName: 'mcphub_get_user',
  },
  {
    expectedArgs: ['alice', { enabled: true }],
    expectedCall: 'users.update',
    input: { body: { enabled: true }, username: 'alice' },
    name: 'updates a user',
    profile: 'admin',
    toolName: 'mcphub_update_user',
  },
];

describe('mcp tool registry', () => {
  it('matches the coverage matrix for the safe profile', () => {
    const actual = listManagedToolsForProfile('safe', allFeatureFlagsEnabled)
      .map((tool) => tool.name)
      .sort();

    expect(actual).toEqual(listExpectedToolNames('safe'));
  });

  it('matches the coverage matrix for the ops profile', () => {
    const actual = listManagedToolsForProfile('ops', allFeatureFlagsEnabled)
      .map((tool) => tool.name)
      .sort();

    expect(actual).toEqual(listExpectedToolNames('ops'));
  });

  it('matches the coverage matrix for the admin profile', () => {
    const actual = listManagedToolsForProfile('admin', allFeatureFlagsEnabled)
      .map((tool) => tool.name)
      .sort();

    expect(actual).toEqual(listExpectedToolNames('admin'));
  });

  it('matches the coverage matrix for the all profile', () => {
    const actual = listManagedToolsForProfile('all', allFeatureFlagsEnabled)
      .map((tool) => tool.name)
      .sort();

    expect(actual).toEqual(listExpectedToolNames('all'));
  });

  it('keeps a stable tools snapshot for the safe profile', () => {
    const snapshot = listManagedToolsForProfile('safe', allFeatureFlagsEnabled).map((tool) => ({
      method: tool.coverage.method,
      name: tool.name,
      path: tool.coverage.path,
      profile: tool.coverage.profile,
    }));

    expect(snapshot).toMatchSnapshot();
  });

  it('keeps a stable tools snapshot for the ops profile', () => {
    const snapshot = listManagedToolsForProfile('ops', allFeatureFlagsEnabled).map((tool) => ({
      method: tool.coverage.method,
      name: tool.name,
      path: tool.coverage.path,
      profile: tool.coverage.profile,
    }));

    expect(snapshot).toMatchSnapshot();
  });

  it('keeps a stable tools snapshot for the admin profile', () => {
    const snapshot = listManagedToolsForProfile('admin', allFeatureFlagsEnabled).map((tool) => ({
      method: tool.coverage.method,
      name: tool.name,
      path: tool.coverage.path,
      profile: tool.coverage.profile,
    }));

    expect(snapshot).toMatchSnapshot();
  });

  it('keeps a stable tools snapshot for the all profile', () => {
    const snapshot = listManagedToolsForProfile('all', allFeatureFlagsEnabled).map((tool) => ({
      method: tool.coverage.method,
      name: tool.name,
      path: tool.coverage.path,
      profile: tool.coverage.profile,
    }));

    expect(snapshot).toMatchSnapshot();
  });

  it.each(registryCases)(
    '$name',
    async ({ expectedArgs, expectedCall, input, profile, toolName }) => {
      const harness = createRegistryHarness();
      const registry = createToolRegistry({
        client: harness.client,
        featureFlags: allFeatureFlagsEnabled,
      });

      const result = await registry.execute(profile, toolName, input);

      expect(harness.calls.at(-1)).toEqual({
        args: expectedArgs,
        call: expectedCall,
      });
      expect(result.structuredContent.data).toEqual({
        args: expectedArgs,
        call: expectedCall,
      });
      expect(result.structuredContent.meta.toolName).toBe(toolName);
    },
  );

  it('redacts sensitive values in tool output', async () => {
    const harness = createRegistryHarness();
    const registry = createToolRegistry({ client: harness.client });

    const result = await registry.execute('safe', 'mcphub_export_settings', undefined);

    expect(result.structuredContent.data).toEqual({
      Authorization: '[REDACTED]',
      headers: '[REDACTED]',
      nested: {
        token: '[REDACTED]',
      },
    });
    expect(result.content[0]?.text).not.toContain('secret-token');
    expect(result.content[0]?.text).not.toContain('jwt-secret');
  });

  it('registers the filtered tool set on the MCP server instance', () => {
    const server = createManagedMcpServer({
      client: createRegistryHarness().client,
      exposureProfile: 'ops',
    });

    const registeredTools = Reflect.get(server, '_registeredTools') as Record<string, unknown>;

    expect(Object.keys(registeredTools).sort()).toEqual(listExpectedToolNames('ops'));
  });

  it('registers managed resources and prompts on the MCP server instance', () => {
    const server = createManagedMcpServer({
      client: createRegistryHarness().client,
      exposureProfile: 'safe',
    });

    const registeredResources = Reflect.get(server, '_registeredResources') as Record<
      string,
      unknown
    >;
    const registeredPrompts = Reflect.get(server, '_registeredPrompts') as Record<string, unknown>;

    expect(Object.keys(registeredResources)).toContain('mcphub://settings/snapshot');
    expect(Object.keys(registeredResources)).toContain('mcphub://logs/stream');
    expect(Object.keys(registeredPrompts)).toContain('mcphub-safe-reload');
  });

  it('uses safe programmatic defaults for gated tools', () => {
    const actual = listManagedToolsForProfile('all').map((tool) => tool.name);

    expect(actual).not.toContain('mcphub_list_bearer_keys');
    expect(actual).not.toContain('mcphub_create_oauth_client');
    expect(actual).not.toContain('mcphub_upload_mcpb_bundle');
    expect(actual).not.toContain('mcphub_update_system_config');
  });

  it('blocks stdio-backed server creation by default in the programmatic registry', async () => {
    const harness = createRegistryHarness();
    const registry = createToolRegistry({ client: harness.client });

    await expect(
      registry.execute('admin', 'mcphub_create_server', {
        command: 'node',
        name: 'server-a',
      }),
    ).rejects.toThrow(/Stdio server creation is disabled/u);
  });

  it('blocks stdio-backed batch server creation by default in the programmatic registry', async () => {
    const harness = createRegistryHarness();
    const registry = createToolRegistry({ client: harness.client });

    await expect(
      registry.execute('admin', 'mcphub_batch_create_servers', [
        {
          command: 'node',
          name: 'server-a',
        },
      ]),
    ).rejects.toThrow(/Stdio server creation is disabled/u);
  });

  it('applies feature flags to dangerous admin and all tools', () => {
    const actual = listManagedToolsForProfile('all', {
      allowAuthAdminTools: false,
      allowMcpbUpload: false,
      allowSystemConfigWrite: false,
    }).map((tool) => tool.name);

    expect(actual).not.toContain('mcphub_list_bearer_keys');
    expect(actual).not.toContain('mcphub_create_oauth_client');
    expect(actual).not.toContain('mcphub_upload_mcpb_bundle');
    expect(actual).not.toContain('mcphub_update_system_config');
  });

  it('enforces readonly mode across elevated profiles', () => {
    const actual = listManagedToolsForProfile('all', {
      forceReadonly: true,
    }).map((tool) => tool.name);

    expect(actual).toContain('mcphub_health_check');
    expect(actual).not.toContain('mcphub_reload_server');
    expect(actual).not.toContain('mcphub_create_server');
    expect(actual).not.toContain('mcphub_update_system_config');
  });
});
