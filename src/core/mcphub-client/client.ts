// SPDX-License-Identifier: Apache-2.0

import { createRequestClient } from './request.js';
import type { McpHubClientOptions } from './types.js';
import { settingsExportSchema, settingsSnapshotSchema } from '../schemas/settings.js';
import { serverListSchema, serverConfigSchema, serverMutationResultSchema, batchCreateServersSchema } from '../schemas/servers.js';
import { serverToolMutationResultSchema } from '../schemas/server-tools.js';
import { serverPromptMutationResultSchema } from '../schemas/server-prompts.js';
import { serverResourceMutationResultSchema } from '../schemas/server-resources.js';
import { groupListSchema, groupSchema, groupMutationResultSchema } from '../schemas/groups.js';
import { userListSchema, userSchema, userStatsSchema, userMutationResultSchema } from '../schemas/users.js';
import { oauthClientListSchema, oauthClientSchema, oauthClientMutationResultSchema } from '../schemas/oauth-clients.js';
import { bearerKeyListSchema, bearerKeyMutationResultSchema } from '../schemas/bearer-keys.js';
import { activityCleanupResultSchema, activityFiltersSchema, activityListSchema, activitySchema, activityStatsSchema } from '../schemas/activities.js';
import { logClearResultSchema, logListSchema } from '../schemas/logs.js';
import { systemConfigUpdateResultSchema } from '../schemas/system.js';
import { groupCostSchema, serverCostSchema } from '../schemas/cost.js';
import { templateExportSchema, templateImportResultSchema } from '../schemas/templates.js';
import { marketCategoryListSchema, marketServerListSchema, marketServerSchema, marketTagListSchema } from '../schemas/market.js';
import { cloudServerListSchema, cloudServerSchema, cloudToolCallResultSchema, cloudToolListSchema } from '../schemas/cloud.js';
import { registryServerListSchema, registryVersionSchema } from '../schemas/registry.js';
import { changelogUpdateInfoSchema } from '../schemas/changelog.js';
import {
  downstreamOpenApiSchema,
  downstreamOpenApiServerListSchema,
  downstreamOpenApiStatsSchema,
} from '../schemas/openapi-introspection.js';
import { builtinPromptListSchema, builtinPromptMutationResultSchema, builtinPromptSchema } from '../schemas/built-in-prompts.js';
import { builtinResourceListSchema, builtinResourceMutationResultSchema, builtinResourceSchema } from '../schemas/built-in-resources.js';
import { betterAuthUserSchema } from '../schemas/better-auth.js';
import { authLoginResultSchema, authUserSchema } from '../schemas/auth-user.js';
import { mcpbUploadResultSchema } from '../schemas/mcpb.js';
import {
  discoveryCategoryListSchema,
  discoveryServerInstallSchema,
  discoveryServerListSchema,
  discoveryServerSchema,
  discoveryTagListSchema,
} from '../schemas/discovery.js';
import { marketplaceWellKnownSchema } from '../schemas/marketplace.js';

function tryUnwrapLegacySuccessEnvelope(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  if (!('success' in value) || !('data' in value)) {
    return value;
  }

  const record = value;
  if (typeof record.success !== 'boolean') {
    return value;
  }

  return record.data;
}

function parseWith<T>(schema: { parse: (value: unknown) => T }, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    const unwrappedValue = tryUnwrapLegacySuccessEnvelope(value);
    if (unwrappedValue === value) {
      throw error;
    }

    return schema.parse(unwrappedValue);
  }
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

export function createMcpHubClient(options: McpHubClientOptions) {
  const request = createRequestClient(options);

  return {
    activities: {
      async cleanup() {
        return parseWith(
          activityCleanupResultSchema,
          await request.json({ method: 'DELETE', path: '/api/activities/cleanup' }),
        );
      },
      async get(id: string) {
        return parseWith(
          activitySchema,
          await request.json({ method: 'GET', path: `/api/activities/${encodePathSegment(id)}` }),
        );
      },
      async getFilters() {
        return parseWith(activityFiltersSchema, await request.json({ method: 'GET', path: '/api/activities/filters' }));
      },
      async getStats() {
        return parseWith(activityStatsSchema, await request.json({ method: 'GET', path: '/api/activities/stats' }));
      },
      async isAvailable() {
        return parseWith(activitySchema, await request.json({ method: 'GET', path: '/api/activities/available' }));
      },
      async list(query?: Record<string, string | number | undefined>) {
        return parseWith(
          activityListSchema,
          await request.json({ method: 'GET', path: '/api/activities', query }),
        );
      },
    },
    auth: {
      async changePassword(body: Record<string, unknown>) {
        return parseWith(
          authLoginResultSchema,
          await request.json({ body, method: 'POST', path: '/api/auth/change-password', idempotent: false }),
        );
      },
      async getCurrentUser() {
        return parseWith(authUserSchema, await request.json({ method: 'GET', path: '/api/auth/user' }));
      },
      async login(body: Record<string, unknown>) {
        return parseWith(
          authLoginResultSchema,
          await request.json({ body, method: 'POST', path: '/api/auth/login', idempotent: false }),
        );
      },
      async register(body: Record<string, unknown>) {
        return parseWith(
          authLoginResultSchema,
          await request.json({ body, method: 'POST', path: '/api/auth/register', idempotent: false }),
        );
      },
    },
    bearerKeys: {
      async create(body: Record<string, unknown>) {
        return parseWith(
          bearerKeyMutationResultSchema,
          await request.json({ body, method: 'POST', path: '/api/auth/keys', idempotent: false }),
        );
      },
      async delete(id: string) {
        return parseWith(
          bearerKeyMutationResultSchema,
          await request.json({ method: 'DELETE', path: `/api/auth/keys/${encodePathSegment(id)}` }),
        );
      },
      async list() {
        return parseWith(bearerKeyListSchema, await request.json({ method: 'GET', path: '/api/auth/keys' }));
      },
      async update(id: string, body: Record<string, unknown>) {
        return parseWith(
          bearerKeyMutationResultSchema,
          await request.json({ body, method: 'PUT', path: `/api/auth/keys/${encodePathSegment(id)}` }),
        );
      },
    },
    betterAuth: {
      async getUser() {
        return parseWith(betterAuthUserSchema, await request.json({ method: 'GET', path: '/api/better-auth/user' }));
      },
    },
    builtinPrompts: {
      async create(body: Record<string, unknown>) {
        return parseWith(
          builtinPromptMutationResultSchema,
          await request.json({ body, method: 'POST', path: '/api/prompts', idempotent: false }),
        );
      },
      async delete(id: string) {
        return parseWith(
          builtinPromptMutationResultSchema,
          await request.json({ method: 'DELETE', path: `/api/prompts/${encodePathSegment(id)}` }),
        );
      },
      async get(id: string) {
        return parseWith(
          builtinPromptSchema,
          await request.json({ method: 'GET', path: `/api/prompts/${encodePathSegment(id)}` }),
        );
      },
      async list() {
        return parseWith(builtinPromptListSchema, await request.json({ method: 'GET', path: '/api/prompts' }));
      },
      async update(id: string, body: Record<string, unknown>) {
        return parseWith(
          builtinPromptMutationResultSchema,
          await request.json({ body, method: 'PUT', path: `/api/prompts/${encodePathSegment(id)}` }),
        );
      },
    },
    builtinResources: {
      async create(body: Record<string, unknown>) {
        return parseWith(
          builtinResourceMutationResultSchema,
          await request.json({ body, method: 'POST', path: '/api/resources', idempotent: false }),
        );
      },
      async delete(id: string) {
        return parseWith(
          builtinResourceMutationResultSchema,
          await request.json({ method: 'DELETE', path: `/api/resources/${encodePathSegment(id)}` }),
        );
      },
      async get(id: string) {
        return parseWith(
          builtinResourceSchema,
          await request.json({ method: 'GET', path: `/api/resources/${encodePathSegment(id)}` }),
        );
      },
      async list() {
        return parseWith(
          builtinResourceListSchema,
          await request.json({ method: 'GET', path: '/api/resources' }),
        );
      },
      async read(body: Record<string, unknown>) {
        return parseWith(
          builtinResourceSchema,
          await request.json({ body, method: 'POST', path: '/api/resources/read', idempotent: false }),
        );
      },
      async update(id: string, body: Record<string, unknown>) {
        return parseWith(
          builtinResourceMutationResultSchema,
          await request.json({ body, method: 'PUT', path: `/api/resources/${encodePathSegment(id)}` }),
        );
      },
    },
    changelog: {
      async getUpdateInfo() {
        return parseWith(
          changelogUpdateInfoSchema,
          await request.json({ method: 'GET', path: '/api/changelog/update-info' }),
        );
      },
    },
    cloud: {
      async callTool(serverName: string, toolName: string, body: Record<string, unknown>) {
        return parseWith(
          cloudToolCallResultSchema,
          await request.json({
            body,
            method: 'POST',
            path: `/api/cloud/servers/${encodePathSegment(serverName)}/tools/${encodePathSegment(toolName)}/call`,
            idempotent: false,
          }),
        );
      },
      async getByCategory(category: string) {
        return parseWith(
          cloudServerListSchema,
          await request.json({ method: 'GET', path: `/api/cloud/categories/${encodePathSegment(category)}` }),
        );
      },
      async getByTag(tag: string) {
        return parseWith(
          cloudServerListSchema,
          await request.json({ method: 'GET', path: `/api/cloud/tags/${encodePathSegment(tag)}` }),
        );
      },
      async getServer(name: string) {
        return parseWith(
          cloudServerSchema,
          await request.json({ method: 'GET', path: `/api/cloud/servers/${encodePathSegment(name)}` }),
        );
      },
      async getTools(serverName: string) {
        return parseWith(
          cloudToolListSchema,
          await request.json({ method: 'GET', path: `/api/cloud/servers/${encodePathSegment(serverName)}/tools` }),
        );
      },
      async listCategories() {
        return parseWith(
          cloudServerListSchema,
          await request.json({ method: 'GET', path: '/api/cloud/categories' }),
        );
      },
      async listServers() {
        return parseWith(cloudServerListSchema, await request.json({ method: 'GET', path: '/api/cloud/servers' }));
      },
      async listTags() {
        return parseWith(cloudServerListSchema, await request.json({ method: 'GET', path: '/api/cloud/tags' }));
      },
      async search(query: string) {
        return parseWith(
          cloudServerListSchema,
          await request.json({ method: 'GET', path: '/api/cloud/servers/search', query: { query } }),
        );
      },
    },
    cost: {
      async getGroupCosts() {
        return parseWith(groupCostSchema, await request.json({ method: 'GET', path: '/api/cost/groups' }));
      },
      async getServerCosts() {
        return parseWith(serverCostSchema, await request.json({ method: 'GET', path: '/api/cost/servers' }));
      },
    },
    discovery: {
      async getServer(name: string) {
        return parseWith(
          discoveryServerSchema,
          await request.json({ method: 'GET', path: `/discovery/servers/${encodePathSegment(name)}` }),
        );
      },
      async getServerInstall(name: string) {
        return parseWith(
          discoveryServerInstallSchema,
          await request.json({ method: 'GET', path: `/discovery/servers/${encodePathSegment(name)}/install` }),
        );
      },
      async listCategories() {
        return parseWith(
          discoveryCategoryListSchema,
          await request.json({ method: 'GET', path: '/discovery/categories' }),
        );
      },
      async listServers() {
        return parseWith(
          discoveryServerListSchema,
          await request.json({ method: 'GET', path: '/discovery/servers' }),
        );
      },
      async listTags() {
        return parseWith(discoveryTagListSchema, await request.json({ method: 'GET', path: '/discovery/tags' }));
      },
    },
    groups: {
      async addServer(groupId: string, body: Record<string, unknown>) {
        return parseWith(
          groupMutationResultSchema,
          await request.json({
            body,
            method: 'POST',
            path: `/api/groups/${encodePathSegment(groupId)}/servers`,
            idempotent: false,
          }),
        );
      },
      async batchCreate(body: Record<string, unknown>) {
        return parseWith(
          groupMutationResultSchema,
          await request.json({ body, method: 'POST', path: '/api/groups/batch', idempotent: false }),
        );
      },
      async create(body: Record<string, unknown>) {
        return parseWith(
          groupMutationResultSchema,
          await request.json({ body, method: 'POST', path: '/api/groups', idempotent: false }),
        );
      },
      async delete(groupId: string) {
        return parseWith(
          groupMutationResultSchema,
          await request.json({ method: 'DELETE', path: `/api/groups/${encodePathSegment(groupId)}` }),
        );
      },
      async get(groupId: string) {
        return parseWith(
          groupSchema,
          await request.json({ method: 'GET', path: `/api/groups/${encodePathSegment(groupId)}` }),
        );
      },
      async getServerConfig(groupId: string, serverName: string) {
        return parseWith(
          groupSchema,
          await request.json({
            method: 'GET',
            path: `/api/groups/${encodePathSegment(groupId)}/server-configs/${encodePathSegment(serverName)}`,
          }),
        );
      },
      async getServerConfigs(groupId: string) {
        return parseWith(
          groupListSchema,
          await request.json({ method: 'GET', path: `/api/groups/${encodePathSegment(groupId)}/server-configs` }),
        );
      },
      async list() {
        return parseWith(groupListSchema, await request.json({ method: 'GET', path: '/api/groups' }));
      },
      async listServers(groupId: string) {
        return parseWith(
          groupListSchema,
          await request.json({ method: 'GET', path: `/api/groups/${encodePathSegment(groupId)}/servers` }),
        );
      },
      async removeServer(groupId: string, serverName: string) {
        return parseWith(
          groupMutationResultSchema,
          await request.json({
            method: 'DELETE',
            path: `/api/groups/${encodePathSegment(groupId)}/servers/${encodePathSegment(serverName)}`,
          }),
        );
      },
      async replaceServers(groupId: string, body: Record<string, unknown>) {
        return parseWith(
          groupMutationResultSchema,
          await request.json({ body, method: 'PUT', path: `/api/groups/${encodePathSegment(groupId)}/servers/batch` }),
        );
      },
      async update(groupId: string, body: Record<string, unknown>) {
        return parseWith(
          groupMutationResultSchema,
          await request.json({ body, method: 'PUT', path: `/api/groups/${encodePathSegment(groupId)}` }),
        );
      },
      async updateServerTools(groupId: string, serverName: string, body: Record<string, unknown>) {
        return parseWith(
          groupMutationResultSchema,
          await request.json({
            body,
            method: 'PUT',
            path: `/api/groups/${encodePathSegment(groupId)}/server-configs/${encodePathSegment(serverName)}/tools`,
          }),
        );
      },
    },
    health: {
      async check() {
        return request.json<unknown>({ method: 'GET', path: '/health' });
      },
    },
    logs: {
      async clear() {
        return parseWith(logClearResultSchema, await request.json({ method: 'DELETE', path: '/api/logs' }));
      },
      async list() {
        return parseWith(logListSchema, await request.json({ method: 'GET', path: '/api/logs' }));
      },
      async stream() {
        return request.json<unknown>({ method: 'GET', path: '/api/logs/stream' });
      },
    },
    market: {
      async getByCategory(category: string) {
        return parseWith(
          marketServerListSchema,
          await request.json({ method: 'GET', path: `/api/market/categories/${encodePathSegment(category)}` }),
        );
      },
      async getByTag(tag: string) {
        return parseWith(
          marketServerListSchema,
          await request.json({ method: 'GET', path: `/api/market/tags/${encodePathSegment(tag)}` }),
        );
      },
      async getServer(name: string) {
        return parseWith(
          marketServerSchema,
          await request.json({ method: 'GET', path: `/api/market/servers/${encodePathSegment(name)}` }),
        );
      },
      async listCategories() {
        return parseWith(
          marketCategoryListSchema,
          await request.json({ method: 'GET', path: '/api/market/categories' }),
        );
      },
      async listServers() {
        return parseWith(marketServerListSchema, await request.json({ method: 'GET', path: '/api/market/servers' }));
      },
      async listTags() {
        return parseWith(marketTagListSchema, await request.json({ method: 'GET', path: '/api/market/tags' }));
      },
      async search(query: string) {
        return parseWith(
          marketServerListSchema,
          await request.json({ method: 'GET', path: '/api/market/servers/search', query: { query } }),
        );
      },
    },
    marketplace: {
      async getWellKnown() {
        return parseWith(
          marketplaceWellKnownSchema,
          await request.json({ method: 'GET', path: '/.well-known/mcp-marketplace' }),
        );
      },
    },
    mcpb: {
      async upload(formData: FormData) {
        return parseWith(
          mcpbUploadResultSchema,
          await request.json({ body: formData, method: 'POST', path: '/api/mcpb/upload', idempotent: false }),
        );
      },
    },
    oauthClients: {
      async create(body: Record<string, unknown>) {
        return parseWith(
          oauthClientMutationResultSchema,
          await request.json({ body, method: 'POST', path: '/api/oauth/clients', idempotent: false }),
        );
      },
      async delete(clientId: string) {
        return parseWith(
          oauthClientMutationResultSchema,
          await request.json({ method: 'DELETE', path: `/api/oauth/clients/${encodePathSegment(clientId)}` }),
        );
      },
      async get(clientId: string) {
        return parseWith(
          oauthClientSchema,
          await request.json({ method: 'GET', path: `/api/oauth/clients/${encodePathSegment(clientId)}` }),
        );
      },
      async list() {
        return parseWith(
          oauthClientListSchema,
          await request.json({ method: 'GET', path: '/api/oauth/clients' }),
        );
      },
      async regenerateSecret(clientId: string) {
        return parseWith(
          oauthClientMutationResultSchema,
          await request.json({
            method: 'POST',
            path: `/api/oauth/clients/${encodePathSegment(clientId)}/regenerate-secret`,
            idempotent: false,
          }),
        );
      },
      async update(clientId: string, body: Record<string, unknown>) {
        return parseWith(
          oauthClientMutationResultSchema,
          await request.json({
            body,
            method: 'PUT',
            path: `/api/oauth/clients/${encodePathSegment(clientId)}`,
          }),
        );
      },
    },
    openApi: {
      async getGroupSpec(groupName: string) {
        return parseWith(
          downstreamOpenApiSchema,
          await request.json({ method: 'GET', path: `/api/${encodePathSegment(groupName)}/openapi.json` }),
        );
      },
      async getSpec() {
        return parseWith(
          downstreamOpenApiSchema,
          await request.json({ method: 'GET', path: '/api/openapi.json' }),
        );
      },
      async getStats() {
        return parseWith(
          downstreamOpenApiStatsSchema,
          await request.json({ method: 'GET', path: '/api/openapi/stats' }),
        );
      },
      async listServers() {
        return parseWith(
          downstreamOpenApiServerListSchema,
          await request.json({ method: 'GET', path: '/api/openapi/servers' }),
        );
      },
    },
    publicConfig: {
      async getRuntimeConfig() {
        return request.json<unknown>({ method: 'GET', path: '/config' });
      },
      async getSnapshot() {
        return request.json<unknown>({ method: 'GET', path: '/public-config' });
      },
    },
    registry: {
      async getServerVersion(query: Record<string, string | number | undefined>) {
        return parseWith(
          registryVersionSchema,
          await request.json({ method: 'GET', path: '/api/registry/servers/version', query }),
        );
      },
      async getServerVersions(query: Record<string, string | number | undefined>) {
        return parseWith(
          registryVersionSchema,
          await request.json({ method: 'GET', path: '/api/registry/servers/versions', query }),
        );
      },
      async listServers(query?: Record<string, string | number | undefined>) {
        return parseWith(
          registryServerListSchema,
          await request.json({ method: 'GET', path: '/api/registry/servers', query }),
        );
      },
    },
    serverPrompts: {
      async resetDescription(serverName: string, promptName: string) {
        return parseWith(
          serverPromptMutationResultSchema,
          await request.json({
            method: 'DELETE',
            path: `/api/servers/${encodePathSegment(serverName)}/prompts/${encodePathSegment(promptName)}/description`,
          }),
        );
      },
      async toggle(serverName: string, promptName: string) {
        return parseWith(
          serverPromptMutationResultSchema,
          await request.json({
            method: 'POST',
            path: `/api/servers/${encodePathSegment(serverName)}/prompts/${encodePathSegment(promptName)}/toggle`,
            idempotent: false,
          }),
        );
      },
      async updateDescription(serverName: string, promptName: string, body: Record<string, unknown>) {
        return parseWith(
          serverPromptMutationResultSchema,
          await request.json({
            body,
            method: 'PUT',
            path: `/api/servers/${encodePathSegment(serverName)}/prompts/${encodePathSegment(promptName)}/description`,
          }),
        );
      },
    },
    serverResources: {
      async resetDescription(serverName: string, resourceUri: string) {
        return parseWith(
          serverResourceMutationResultSchema,
          await request.json({
            method: 'DELETE',
            path: `/api/servers/${encodePathSegment(serverName)}/resources/${encodePathSegment(resourceUri)}/description`,
          }),
        );
      },
      async toggle(serverName: string, resourceUri: string) {
        return parseWith(
          serverResourceMutationResultSchema,
          await request.json({
            method: 'POST',
            path: `/api/servers/${encodePathSegment(serverName)}/resources/${encodePathSegment(resourceUri)}/toggle`,
            idempotent: false,
          }),
        );
      },
      async updateDescription(serverName: string, resourceUri: string, body: Record<string, unknown>) {
        return parseWith(
          serverResourceMutationResultSchema,
          await request.json({
            body,
            method: 'PUT',
            path: `/api/servers/${encodePathSegment(serverName)}/resources/${encodePathSegment(resourceUri)}/description`,
          }),
        );
      },
    },
    servers: {
      async batchCreate(body: unknown[]) {
        return parseWith(
          serverMutationResultSchema,
          await request.json({
            body: batchCreateServersSchema.parse(body),
            method: 'POST',
            path: '/api/servers/batch',
            idempotent: false,
          }),
        );
      },
      async create(body: Record<string, unknown>) {
        return parseWith(
          serverMutationResultSchema,
          await request.json({ body, method: 'POST', path: '/api/servers', idempotent: false }),
        );
      },
      async delete(name: string) {
        return parseWith(
          serverMutationResultSchema,
          await request.json({ method: 'DELETE', path: `/api/servers/${encodePathSegment(name)}` }),
        );
      },
      async get(name: string) {
        return parseWith(
          serverConfigSchema,
          await request.json({ method: 'GET', path: `/api/servers/${encodePathSegment(name)}` }),
        );
      },
      async list() {
        return parseWith(serverListSchema, await request.json({ method: 'GET', path: '/api/servers' }));
      },
      async reload(name: string) {
        return parseWith(
          serverMutationResultSchema,
          await request.json({
            method: 'POST',
            path: `/api/servers/${encodePathSegment(name)}/reload`,
            idempotent: false,
          }),
        );
      },
      async toggle(name: string) {
        return parseWith(
          serverMutationResultSchema,
          await request.json({
            method: 'POST',
            path: `/api/servers/${encodePathSegment(name)}/toggle`,
            idempotent: false,
          }),
        );
      },
      async update(name: string, body: Record<string, unknown>) {
        return parseWith(
          serverMutationResultSchema,
          await request.json({ body, method: 'PUT', path: `/api/servers/${encodePathSegment(name)}` }),
        );
      },
    },
    serverTools: {
      async resetDescription(serverName: string, toolName: string) {
        return parseWith(
          serverToolMutationResultSchema,
          await request.json({
            method: 'DELETE',
            path: `/api/servers/${encodePathSegment(serverName)}/tools/${encodePathSegment(toolName)}/description`,
          }),
        );
      },
      async toggle(serverName: string, toolName: string) {
        return parseWith(
          serverToolMutationResultSchema,
          await request.json({
            method: 'POST',
            path: `/api/servers/${encodePathSegment(serverName)}/tools/${encodePathSegment(toolName)}/toggle`,
            idempotent: false,
          }),
        );
      },
      async updateDescription(serverName: string, toolName: string, body: Record<string, unknown>) {
        return parseWith(
          serverToolMutationResultSchema,
          await request.json({
            body,
            method: 'PUT',
            path: `/api/servers/${encodePathSegment(serverName)}/tools/${encodePathSegment(toolName)}/description`,
          }),
        );
      },
    },
    settings: {
      async export() {
        return parseWith(
          settingsExportSchema,
          await request.json({ method: 'GET', path: '/api/mcp-settings/export' }),
        );
      },
      async getSnapshot() {
        return parseWith(settingsSnapshotSchema, await request.json({ method: 'GET', path: '/api/settings' }));
      },
    },
    system: {
      async updateConfig(body: Record<string, unknown>) {
        return parseWith(
          systemConfigUpdateResultSchema,
          await request.json({ body, method: 'PUT', path: '/api/system-config' }),
        );
      },
    },
    templates: {
      async exportConfig(body: Record<string, unknown>) {
        return parseWith(
          templateExportSchema,
          await request.json({ body, method: 'POST', path: '/api/templates/export', idempotent: false }),
        );
      },
      async exportGroup(groupId: string) {
        return parseWith(
          templateExportSchema,
          await request.json({
            method: 'GET',
            path: `/api/templates/export/groups/${encodePathSegment(groupId)}`,
          }),
        );
      },
      async importConfig(body: Record<string, unknown>) {
        return parseWith(
          templateImportResultSchema,
          await request.json({ body, method: 'POST', path: '/api/templates/import', idempotent: false }),
        );
      },
    },
    users: {
      async create(body: Record<string, unknown>) {
        return parseWith(
          userMutationResultSchema,
          await request.json({ body, method: 'POST', path: '/api/users', idempotent: false }),
        );
      },
      async delete(username: string) {
        return parseWith(
          userMutationResultSchema,
          await request.json({ method: 'DELETE', path: `/api/users/${encodePathSegment(username)}` }),
        );
      },
      async get(username: string) {
        return parseWith(
          userSchema,
          await request.json({ method: 'GET', path: `/api/users/${encodePathSegment(username)}` }),
        );
      },
      async getStats() {
        return parseWith(userStatsSchema, await request.json({ method: 'GET', path: '/api/users-stats' }));
      },
      async list() {
        return parseWith(userListSchema, await request.json({ method: 'GET', path: '/api/users' }));
      },
      async update(username: string, body: Record<string, unknown>) {
        return parseWith(
          userMutationResultSchema,
          await request.json({ body, method: 'PUT', path: `/api/users/${encodePathSegment(username)}` }),
        );
      },
    },
  };
}
