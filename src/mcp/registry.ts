// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';

import { COVERAGE } from '../core/coverage/matrix.js';
import type { CoverageEntry, ExposureProfile, RiskClass } from '../core/coverage/types.js';
import { createMcpHubClient } from '../core/mcphub-client/client.js';
import { createRedactor } from '../core/redaction/redactor.js';
import {
  assertAllowedCommand,
  assertAllowedTargetHost,
  extractCandidateUrls,
} from '../security/allowlist.js';
import { assertSafeDescription } from '../security/description-lint.js';
import { assertNoPrivateUrl } from '../security/ssrf.js';
import { getSdkAnnotationsForRisk } from './annotations.js';

const exposureRank: Record<ExposureProfile, number> = {
  safe: 0,
  ops: 1,
  admin: 2,
  all: 3,
};

const nonEmptyStringSchema = z.string().min(1);
const looseObjectSchema = z.looseObject({});
const genericToolOutputSchema = {
  data: z.unknown(),
  meta: z.object({
    endpoint: z.string(),
    method: z.enum(['DELETE', 'GET', 'POST', 'PUT']),
    profile: z.enum(['safe', 'ops', 'admin', 'all']),
    toolName: z.string(),
  }),
};

const byCategorySchema = z.object({
  category: nonEmptyStringSchema.describe('Category identifier.'),
});

const byIdSchema = z.object({
  id: nonEmptyStringSchema.describe('Entity identifier.'),
});

const byNameSchema = z.object({
  name: nonEmptyStringSchema.describe('Entity name.'),
});

const byServerNameSchema = z.object({
  serverName: nonEmptyStringSchema.describe('Server name.'),
});

const byTagSchema = z.object({
  tag: nonEmptyStringSchema.describe('Tag identifier.'),
});

const groupIdSchema = z.object({
  groupId: nonEmptyStringSchema.describe('Group identifier.'),
});

const groupServerConfigSchema = z.object({
  groupId: nonEmptyStringSchema.describe('Group identifier.'),
  serverName: nonEmptyStringSchema.describe('Server name.'),
});

const groupServerMembershipSchema = z.object({
  groupId: nonEmptyStringSchema.describe('Group identifier.'),
  serverName: nonEmptyStringSchema.describe('Server name.'),
});

const promptDescriptionSchema = z.object({
  description: nonEmptyStringSchema.describe('New prompt description.'),
  promptName: nonEmptyStringSchema.describe('Prompt name.'),
  serverName: nonEmptyStringSchema.describe('Server name.'),
});

const promptToggleSchema = z.object({
  promptName: nonEmptyStringSchema.describe('Prompt name.'),
  serverName: nonEmptyStringSchema.describe('Server name.'),
});

const registryQuerySchema = z.object({
  cursor: nonEmptyStringSchema.optional().describe('Optional pagination cursor.'),
  limit: z.number().int().positive().optional().describe('Optional page size.'),
  search: nonEmptyStringSchema.optional().describe('Optional search filter.'),
});

const registryVersionSchema = z.object({
  name: nonEmptyStringSchema.describe('Registry server name.'),
  version: nonEmptyStringSchema.optional().describe('Specific version identifier.'),
});

const resourceDescriptionSchema = z.object({
  description: nonEmptyStringSchema.describe('New resource description.'),
  resourceUri: nonEmptyStringSchema.describe('Resource URI.'),
  serverName: nonEmptyStringSchema.describe('Server name.'),
});

const resourceReadSchema = z.looseObject({
  uri: nonEmptyStringSchema.describe('Built-in resource URI to read.'),
});
const resourceToggleSchema = z.object({
  resourceUri: nonEmptyStringSchema.describe('Resource URI.'),
  serverName: nonEmptyStringSchema.describe('Server name.'),
});

const searchQuerySchema = z.object({
  query: nonEmptyStringSchema.describe('Search query string.'),
});

const serverNameAndToolSchema = z.object({
  serverName: nonEmptyStringSchema.describe('Server name.'),
  toolName: nonEmptyStringSchema.describe('Tool name.'),
});

const toolDescriptionSchema = z.object({
  description: nonEmptyStringSchema.describe('New tool description.'),
  serverName: nonEmptyStringSchema.describe('Server name.'),
  toolName: nonEmptyStringSchema.describe('Tool name.'),
});

const updateBuiltinPromptSchema = z.looseObject({
  content: z.string().optional().describe('Prompt content override.'),
  description: z.string().optional().describe('Prompt description override.'),
  id: nonEmptyStringSchema.describe('Built-in prompt identifier.'),
  name: z.string().optional().describe('Prompt name override.'),
});

const updateBuiltinResourceSchema = z.looseObject({
  description: z.string().optional().describe('Resource description override.'),
  id: nonEmptyStringSchema.describe('Built-in resource identifier.'),
  mimeType: z.string().optional().describe('Resource MIME type override.'),
  name: z.string().optional().describe('Resource name override.'),
  uri: z.string().optional().describe('Resource URI override.'),
});

const updateGroupServerToolsSchema = z.looseObject({
  groupId: nonEmptyStringSchema.describe('Group identifier.'),
  serverName: nonEmptyStringSchema.describe('Server name.'),
  tools: z.array(nonEmptyStringSchema).describe('Selected tools for the group-specific override.'),
});

const replaceGroupServersSchema = z.looseObject({
  groupId: nonEmptyStringSchema.describe('Group identifier.'),
  servers: z.array(nonEmptyStringSchema).describe('Replacement server list.'),
});

const exportConfigTemplateSchema = looseObjectSchema.describe('Template export parameters.');
const createLooseArraySchema = z.array(looseObjectSchema);
const mcpbUploadSchema = z.object({
  confirm: z.literal(true).describe('Must be true to acknowledge bundle upload.'),
  contentBase64: nonEmptyStringSchema.describe('Base64-encoded MCPB bundle bytes.'),
  filename: nonEmptyStringSchema.describe('Uploaded filename, for example bundle.mcpb.'),
  mimeType: z.string().optional().describe('Optional MIME type for the uploaded bundle.'),
  reason: nonEmptyStringSchema.describe('Why the bundle upload is needed.'),
});

const confirmActionSchema = z.object({
  confirm: z.literal(true).describe('Must be true to acknowledge the destructive action.'),
  reason: nonEmptyStringSchema.describe('Why the destructive action is needed.'),
});

const confirmByGroupIdSchema = confirmActionSchema.extend({
  expectedGroupId: nonEmptyStringSchema.describe('Required safety check for the target group id.'),
  groupId: nonEmptyStringSchema.describe('Group identifier.'),
});

const confirmByIdSchema = confirmActionSchema.extend({
  expectedId: nonEmptyStringSchema.describe('Required safety check for the target identifier.'),
  id: nonEmptyStringSchema.describe('Target identifier.'),
});

const confirmByNameSchema = confirmActionSchema.extend({
  expectedName: nonEmptyStringSchema.describe('Required safety check for the target name.'),
  name: nonEmptyStringSchema.describe('Target name.'),
});

const confirmByUsernameSchema = confirmActionSchema.extend({
  expectedUsername: nonEmptyStringSchema.describe('Required safety check for the target username.'),
  username: nonEmptyStringSchema.describe('Target username.'),
});

const createBearerKeySchema = looseObjectSchema;
const createGroupSchema = looseObjectSchema;
const createOAuthClientSchema = looseObjectSchema;
const createPromptSchema = looseObjectSchema;
const createResourceSchema = looseObjectSchema;
const createServerSchema = looseObjectSchema;
const createUserSchema = looseObjectSchema;
const importConfigTemplateSchema = z.looseObject({
  confirm: z.literal(true).describe('Must be true to acknowledge the destructive action.'),
  expectedOperation: z
    .literal('import-config-template')
    .describe(
      'Required safety check confirming that this tool will import a configuration template.',
    ),
  reason: nonEmptyStringSchema.describe('Why the destructive action is needed.'),
});
const oauthClientIdSchema = z.object({
  clientId: nonEmptyStringSchema.describe('OAuth client identifier.'),
});
const regenerateOAuthClientSecretSchema = confirmActionSchema.extend({
  clientId: nonEmptyStringSchema.describe('OAuth client identifier.'),
  expectedClientId: nonEmptyStringSchema.describe(
    'Required safety check for the target client id.',
  ),
});
const systemConfigUpdateSchema = z.looseObject({
  confirm: z.literal(true).describe('Must be true to acknowledge the destructive action.'),
  expectedOperation: z
    .literal('update-system-config')
    .describe('Required safety check confirming that this tool will update system configuration.'),
  reason: nonEmptyStringSchema.describe('Why the destructive action is needed.'),
});
const updateBearerKeySchema = z.object({
  body: looseObjectSchema.describe('Bearer key update payload.'),
  id: nonEmptyStringSchema.describe('Bearer key identifier.'),
});
const updateGroupSchema = z.object({
  body: looseObjectSchema.describe('Group update payload.'),
  groupId: nonEmptyStringSchema.describe('Group identifier.'),
});
const updateOAuthClientSchema = z.object({
  body: looseObjectSchema.describe('OAuth client update payload.'),
  clientId: nonEmptyStringSchema.describe('OAuth client identifier.'),
});
const updateServerSchema = z.object({
  body: looseObjectSchema.describe('Server update payload.'),
  name: nonEmptyStringSchema.describe('Server name.'),
});
const updateUserSchema = z.object({
  body: looseObjectSchema.describe('User update payload.'),
  username: nonEmptyStringSchema.describe('Target username.'),
});

function assertExpectedValue(actual: string, expected: string | undefined, label: string): void {
  if (expected !== undefined && actual !== expected) {
    throw new Error(`Expected ${label} "${expected}" does not match actual target "${actual}".`);
  }
}

function validateDescription(description: string): void {
  assertSafeDescription(description);
}

function validateServerMutationPayload(
  payload: Record<string, unknown>,
  flags: ToolFeatureFlags,
): void {
  const command = payload.command;
  if (typeof command === 'string' && command.length > 0) {
    assertAllowedCommand(command, flags.allowStdioServerCreate);
  }

  for (const candidateUrl of extractCandidateUrls(payload)) {
    assertNoPrivateUrl(candidateUrl);
    assertAllowedTargetHost(candidateUrl, flags.allowedTargetHosts);
  }
}

type McpHubClient = ReturnType<typeof createMcpHubClient>;
type Redactor = ReturnType<typeof createRedactor>;
type StructuredToolResult = {
  content: Array<{ text: string; type: 'text' }>;
  structuredContent: {
    data: unknown;
    meta: {
      endpoint: string;
      method: CoverageEntry['method'];
      profile: ExposureProfile;
      toolName: string;
    };
  };
};

type ToolExecutionContext = {
  client: McpHubClient;
  featureFlags: ToolFeatureFlags;
  redactor: Redactor;
};

export type ToolFeatureFlags = {
  allowAuthAdminTools: boolean;
  allowMcpbUpload: boolean;
  allowStdioServerCreate: boolean;
  allowSystemConfigWrite: boolean;
  allowedTargetHosts: string[];
  forceReadonly: boolean;
};

export type ToolFeatureFlagName =
  | 'allowAuthAdminTools'
  | 'allowMcpbUpload'
  | 'allowStdioServerCreate'
  | 'allowSystemConfigWrite';

export type ManagedToolDefinition = {
  annotations: ReturnType<typeof getSdkAnnotationsForRisk>;
  coverage: CoverageEntry;
  description: string;
  execute: (context: ToolExecutionContext, input: unknown) => Promise<StructuredToolResult>;
  isEnabled?: ((flags: ToolFeatureFlags) => boolean) | undefined;
  inputSchema?: z.ZodType | undefined;
  name: string;
  outputSchema: typeof genericToolOutputSchema;
  requiredFeatureFlags: ToolFeatureFlagName[];
};

function getCoverageEntryByToolName(toolName: string): CoverageEntry {
  const entry = COVERAGE.find(
    (candidate) => candidate.mcp.kind === 'tool' && candidate.mcp.name === toolName,
  );

  if (entry === undefined || entry.profile === null || entry.risk === null) {
    throw new Error(`Coverage metadata is missing for tool "${toolName}".`);
  }

  return entry;
}

function createToolResult(
  coverage: CoverageEntry,
  responseData: unknown,
  redactor: Redactor,
): StructuredToolResult {
  const redactedData = redactor.redactValue(responseData);
  const structuredContent = {
    data: redactedData,
    meta: {
      endpoint: coverage.path,
      method: coverage.method,
      profile: coverage.profile as ExposureProfile,
      toolName: coverage.mcp.name ?? 'unknown',
    },
  };

  return {
    content: [
      {
        text: JSON.stringify(structuredContent, null, 2),
        type: 'text',
      },
    ],
    structuredContent,
  };
}

function defineTool(
  name: string,
  description: string,
  execute: (context: ToolExecutionContext, input: unknown) => Promise<unknown>,
  inputSchema?: z.ZodType,
  isEnabled?: (flags: ToolFeatureFlags) => boolean,
  requiredFeatureFlags: ToolFeatureFlagName[] = [],
): ManagedToolDefinition {
  const coverage = getCoverageEntryByToolName(name);

  return {
    annotations: getSdkAnnotationsForRisk(coverage.risk as RiskClass),
    coverage,
    description,
    execute: async (context, input) =>
      createToolResult(coverage, await execute(context, input), context.redactor),
    ...(isEnabled !== undefined ? { isEnabled } : {}),
    inputSchema,
    name,
    outputSchema: genericToolOutputSchema,
    requiredFeatureFlags,
  };
}

function isProfileAllowed(selectedProfile: ExposureProfile, toolProfile: ExposureProfile): boolean {
  return exposureRank[selectedProfile] >= exposureRank[toolProfile];
}

const SAFE_AND_OPS_TOOLS: ManagedToolDefinition[] = [
  defineTool(
    'mcphub_get_marketplace_well_known',
    'Get the public MCP marketplace manifest exposed by this MCPHub instance.',
    async ({ client }) => client.marketplace.getWellKnown(),
  ),
  defineTool(
    'mcphub_get_group_downstream_openapi_spec',
    'Get the downstream OpenAPI document for a named MCPHub group.',
    async ({ client }, input) => {
      const { name } = byNameSchema.parse(input);
      return client.openApi.getGroupSpec(name);
    },
    byNameSchema,
  ),
  defineTool(
    'mcphub_list_activities',
    'List recorded MCPHub activities with optional pagination and filtering.',
    async ({ client }, input) => client.activities.list(registryQuerySchema.parse(input ?? {})),
    registryQuerySchema.partial(),
  ),
  defineTool(
    'mcphub_get_activity',
    'Get one activity entry by identifier.',
    async ({ client }, input) => {
      const { id } = byIdSchema.parse(input);
      return client.activities.get(id);
    },
    byIdSchema,
  ),
  defineTool(
    'mcphub_check_activities_available',
    'Check whether activity endpoints are available on the connected MCPHub instance.',
    async ({ client }) => client.activities.isAvailable(),
  ),
  defineTool(
    'mcphub_get_activity_filters',
    'Get available activity filter metadata.',
    async ({ client }) => client.activities.getFilters(),
  ),
  defineTool(
    'mcphub_get_activity_stats',
    'Get aggregate activity statistics.',
    async ({ client }) => client.activities.getStats(),
  ),
  defineTool(
    'mcphub_get_current_user',
    'Get the currently authenticated management user.',
    async ({ client }) => client.auth.getCurrentUser(),
  ),
  defineTool(
    'mcphub_get_better_auth_user',
    'Get the current Better Auth user, when Better Auth is enabled upstream.',
    async ({ client }) => client.betterAuth.getUser(),
  ),
  defineTool(
    'mcphub_get_changelog_update_info',
    'Get MCPHub changelog update information.',
    async ({ client }) => client.changelog.getUpdateInfo(),
  ),
  defineTool(
    'mcphub_list_cloud_categories',
    'List available cloud marketplace categories.',
    async ({ client }) => client.cloud.listCategories(),
  ),
  defineTool(
    'mcphub_get_cloud_servers_by_category',
    'Get cloud marketplace servers for a category.',
    async ({ client }, input) => {
      const { category } = byCategorySchema.parse(input);
      return client.cloud.getByCategory(category);
    },
    byCategorySchema,
  ),
  defineTool('mcphub_list_cloud_servers', 'List cloud marketplace servers.', async ({ client }) =>
    client.cloud.listServers(),
  ),
  defineTool(
    'mcphub_get_cloud_server',
    'Get one cloud marketplace server by name.',
    async ({ client }, input) => {
      const { name } = byNameSchema.parse(input);
      return client.cloud.getServer(name);
    },
    byNameSchema,
  ),
  defineTool(
    'mcphub_get_cloud_server_tools',
    'List tools exposed by a cloud marketplace server.',
    async ({ client }, input) => {
      const { serverName } = byServerNameSchema.parse(input);
      return client.cloud.getTools(serverName);
    },
    byServerNameSchema,
  ),
  defineTool(
    'mcphub_search_cloud_servers',
    'Search cloud marketplace servers by query.',
    async ({ client }, input) => {
      const { query } = searchQuerySchema.parse(input);
      return client.cloud.search(query);
    },
    searchQuerySchema,
  ),
  defineTool(
    'mcphub_list_cloud_tags',
    'List available cloud marketplace tags.',
    async ({ client }) => client.cloud.listTags(),
  ),
  defineTool(
    'mcphub_get_cloud_servers_by_tag',
    'Get cloud marketplace servers for a tag.',
    async ({ client }, input) => {
      const { tag } = byTagSchema.parse(input);
      return client.cloud.getByTag(tag);
    },
    byTagSchema,
  ),
  defineTool('mcphub_get_group_costs', 'Get cost aggregates for groups.', async ({ client }) =>
    client.cost.getGroupCosts(),
  ),
  defineTool('mcphub_get_server_costs', 'Get cost aggregates for servers.', async ({ client }) =>
    client.cost.getServerCosts(),
  ),
  defineTool('mcphub_list_groups', 'List MCPHub groups.', async ({ client }) =>
    client.groups.list(),
  ),
  defineTool(
    'mcphub_get_group',
    'Get one MCPHub group by identifier.',
    async ({ client }, input) => {
      const { groupId } = groupIdSchema.parse(input);
      return client.groups.get(groupId);
    },
    groupIdSchema,
  ),
  defineTool(
    'mcphub_get_group_server_configs',
    'Get the group-level server configuration overrides for a group.',
    async ({ client }, input) => {
      const { groupId } = groupIdSchema.parse(input);
      return client.groups.getServerConfigs(groupId);
    },
    groupIdSchema,
  ),
  defineTool(
    'mcphub_get_group_server_config',
    'Get one group-level server configuration override.',
    async ({ client }, input) => {
      const { groupId, serverName } = groupServerConfigSchema.parse(input);
      return client.groups.getServerConfig(groupId, serverName);
    },
    groupServerConfigSchema,
  ),
  defineTool(
    'mcphub_update_group_server_tools',
    'Replace the enabled tool selection for a server inside a group override.',
    async ({ client }, input) => {
      const { groupId, serverName, tools } = updateGroupServerToolsSchema.parse(input);
      return client.groups.updateServerTools(groupId, serverName, { tools });
    },
    updateGroupServerToolsSchema,
  ),
  defineTool(
    'mcphub_list_group_servers',
    'List servers assigned to a group.',
    async ({ client }, input) => {
      const { groupId } = groupIdSchema.parse(input);
      return client.groups.listServers(groupId);
    },
    groupIdSchema,
  ),
  defineTool(
    'mcphub_add_server_to_group',
    'Add a server to a group.',
    async ({ client }, input) => {
      const { groupId, serverName } = groupServerMembershipSchema.parse(input);
      return client.groups.addServer(groupId, { serverName });
    },
    groupServerMembershipSchema,
  ),
  defineTool(
    'mcphub_remove_server_from_group',
    'Remove a server from a group.',
    async ({ client }, input) => {
      const { groupId, serverName } = groupServerMembershipSchema.parse(input);
      return client.groups.removeServer(groupId, serverName);
    },
    groupServerMembershipSchema,
  ),
  defineTool(
    'mcphub_replace_group_servers',
    'Replace the full server membership of a group.',
    async ({ client }, input) => {
      const { groupId, servers } = replaceGroupServersSchema.parse(input);
      return client.groups.replaceServers(groupId, { servers });
    },
    replaceGroupServersSchema,
  ),
  defineTool('mcphub_get_logs', 'Get MCPHub log entries.', async ({ client }) =>
    client.logs.list(),
  ),
  defineTool(
    'mcphub_list_market_categories',
    'List local marketplace categories.',
    async ({ client }) => client.market.listCategories(),
  ),
  defineTool(
    'mcphub_get_market_servers_by_category',
    'Get local marketplace servers for a category.',
    async ({ client }, input) => {
      const { category } = byCategorySchema.parse(input);
      return client.market.getByCategory(category);
    },
    byCategorySchema,
  ),
  defineTool('mcphub_list_market_servers', 'List local marketplace servers.', async ({ client }) =>
    client.market.listServers(),
  ),
  defineTool(
    'mcphub_get_market_server',
    'Get one local marketplace server by name.',
    async ({ client }, input) => {
      const { name } = byNameSchema.parse(input);
      return client.market.getServer(name);
    },
    byNameSchema,
  ),
  defineTool(
    'mcphub_search_market_servers',
    'Search local marketplace servers by query.',
    async ({ client }, input) => {
      const { query } = searchQuerySchema.parse(input);
      return client.market.search(query);
    },
    searchQuerySchema,
  ),
  defineTool('mcphub_list_market_tags', 'List local marketplace tags.', async ({ client }) =>
    client.market.listTags(),
  ),
  defineTool(
    'mcphub_get_market_servers_by_tag',
    'Get local marketplace servers for a tag.',
    async ({ client }, input) => {
      const { tag } = byTagSchema.parse(input);
      return client.market.getByTag(tag);
    },
    byTagSchema,
  ),
  defineTool(
    'mcphub_export_settings',
    'Export MCPHub settings with server-side redaction applied to sensitive fields.',
    async ({ client }) => client.settings.export(),
  ),
  defineTool(
    'mcphub_get_downstream_openapi_spec',
    'Get the downstream OpenAPI document published by MCPHub.',
    async ({ client }) => client.openApi.getSpec(),
  ),
  defineTool(
    'mcphub_list_openapi_servers',
    'List servers included in MCPHub downstream OpenAPI generation.',
    async ({ client }) => client.openApi.listServers(),
  ),
  defineTool(
    'mcphub_get_openapi_stats',
    'Get downstream OpenAPI generation statistics.',
    async ({ client }) => client.openApi.getStats(),
  ),
  defineTool(
    'mcphub_list_builtin_prompts',
    'List built-in prompts stored in MCPHub.',
    async ({ client }) => client.builtinPrompts.list(),
  ),
  defineTool(
    'mcphub_get_builtin_prompt',
    'Get one built-in prompt by identifier.',
    async ({ client }, input) => {
      const { id } = byIdSchema.parse(input);
      return client.builtinPrompts.get(id);
    },
    byIdSchema,
  ),
  defineTool(
    'mcphub_update_builtin_prompt',
    'Update a built-in prompt in place.',
    async ({ client }, input) => {
      const { id, ...body } = updateBuiltinPromptSchema.parse(input);
      if (typeof body.description === 'string') {
        validateDescription(body.description);
      }
      return client.builtinPrompts.update(id, body);
    },
    updateBuiltinPromptSchema,
  ),
  defineTool(
    'mcphub_list_registry_servers',
    'List official MCP registry servers as proxied by MCPHub.',
    async ({ client }, input) =>
      client.registry.listServers(registryQuerySchema.parse(input ?? {})),
    registryQuerySchema.partial(),
  ),
  defineTool(
    'mcphub_get_registry_server_version',
    'Get metadata for one MCP registry server version.',
    async ({ client }, input) => {
      const parsed = registryVersionSchema.parse(input);
      return client.registry.getServerVersion(parsed);
    },
    registryVersionSchema,
  ),
  defineTool(
    'mcphub_get_registry_server_versions',
    'Get the version index for one MCP registry server.',
    async ({ client }, input) => {
      const parsed = z.object({ name: nonEmptyStringSchema }).parse(input);
      return client.registry.getServerVersions(parsed);
    },
    z.object({
      name: nonEmptyStringSchema.describe('Registry server name.'),
    }),
  ),
  defineTool(
    'mcphub_list_builtin_resources',
    'List built-in MCPHub resources.',
    async ({ client }) => client.builtinResources.list(),
  ),
  defineTool(
    'mcphub_get_builtin_resource',
    'Get one built-in resource by identifier.',
    async ({ client }, input) => {
      const { id } = byIdSchema.parse(input);
      return client.builtinResources.get(id);
    },
    byIdSchema,
  ),
  defineTool(
    'mcphub_update_builtin_resource',
    'Update a built-in resource in place.',
    async ({ client }, input) => {
      const { id, ...body } = updateBuiltinResourceSchema.parse(input);
      if (typeof body.description === 'string') {
        validateDescription(body.description);
      }
      return client.builtinResources.update(id, body);
    },
    updateBuiltinResourceSchema,
  ),
  defineTool(
    'mcphub_read_builtin_resource',
    'Read a built-in resource payload via MCPHub.',
    async ({ client }, input) => client.builtinResources.read(resourceReadSchema.parse(input)),
    resourceReadSchema,
  ),
  defineTool('mcphub_list_servers', 'List MCPHub servers.', async ({ client }) =>
    client.servers.list(),
  ),
  defineTool(
    'mcphub_get_server',
    'Get one MCPHub server by name.',
    async ({ client }, input) => {
      const { name } = byNameSchema.parse(input);
      return client.servers.get(name);
    },
    byNameSchema,
  ),
  defineTool(
    'mcphub_reload_server',
    'Reload one MCPHub server.',
    async ({ client }, input) => {
      const { name } = byNameSchema.parse(input);
      return client.servers.reload(name);
    },
    byNameSchema,
  ),
  defineTool(
    'mcphub_toggle_server',
    'Toggle one MCPHub server enabled state.',
    async ({ client }, input) => {
      const { name } = byNameSchema.parse(input);
      return client.servers.toggle(name);
    },
    byNameSchema,
  ),
  defineTool(
    'mcphub_reset_server_prompt_description',
    'Reset a per-server prompt description override.',
    async ({ client }, input) => {
      const { promptName, serverName } = promptToggleSchema.parse(input);
      return client.serverPrompts.resetDescription(serverName, promptName);
    },
    promptToggleSchema,
  ),
  defineTool(
    'mcphub_update_server_prompt_description',
    'Update a per-server prompt description override.',
    async ({ client }, input) => {
      const { description, promptName, serverName } = promptDescriptionSchema.parse(input);
      validateDescription(description);
      return client.serverPrompts.updateDescription(serverName, promptName, { description });
    },
    promptDescriptionSchema,
  ),
  defineTool(
    'mcphub_toggle_server_prompt',
    'Toggle a prompt exposed by a server.',
    async ({ client }, input) => {
      const { promptName, serverName } = promptToggleSchema.parse(input);
      return client.serverPrompts.toggle(serverName, promptName);
    },
    promptToggleSchema,
  ),
  defineTool(
    'mcphub_reset_server_resource_description',
    'Reset a per-server resource description override.',
    async ({ client }, input) => {
      const { resourceUri, serverName } = resourceToggleSchema.parse(input);
      return client.serverResources.resetDescription(serverName, resourceUri);
    },
    resourceToggleSchema,
  ),
  defineTool(
    'mcphub_update_server_resource_description',
    'Update a per-server resource description override.',
    async ({ client }, input) => {
      const { description, resourceUri, serverName } = resourceDescriptionSchema.parse(input);
      validateDescription(description);
      return client.serverResources.updateDescription(serverName, resourceUri, { description });
    },
    resourceDescriptionSchema,
  ),
  defineTool(
    'mcphub_toggle_server_resource',
    'Toggle a resource exposed by a server.',
    async ({ client }, input) => {
      const { resourceUri, serverName } = resourceToggleSchema.parse(input);
      return client.serverResources.toggle(serverName, resourceUri);
    },
    resourceToggleSchema,
  ),
  defineTool(
    'mcphub_reset_server_tool_description',
    'Reset a per-server tool description override.',
    async ({ client }, input) => {
      const { serverName, toolName } = serverNameAndToolSchema.parse(input);
      return client.serverTools.resetDescription(serverName, toolName);
    },
    serverNameAndToolSchema,
  ),
  defineTool(
    'mcphub_update_server_tool_description',
    'Update a per-server tool description override.',
    async ({ client }, input) => {
      const { description, serverName, toolName } = toolDescriptionSchema.parse(input);
      validateDescription(description);
      return client.serverTools.updateDescription(serverName, toolName, { description });
    },
    toolDescriptionSchema,
  ),
  defineTool(
    'mcphub_toggle_server_tool',
    'Toggle a tool exposed by a server.',
    async ({ client }, input) => {
      const { serverName, toolName } = serverNameAndToolSchema.parse(input);
      return client.serverTools.toggle(serverName, toolName);
    },
    serverNameAndToolSchema,
  ),
  defineTool(
    'mcphub_get_settings_snapshot',
    'Get the live MCPHub settings snapshot with secret redaction.',
    async ({ client }) => client.settings.getSnapshot(),
  ),
  defineTool(
    'mcphub_export_config_template',
    'Export an MCPHub configuration template.',
    async ({ client }, input) =>
      client.templates.exportConfig(exportConfigTemplateSchema.parse(input)),
    exportConfigTemplateSchema,
  ),
  defineTool(
    'mcphub_export_group_template',
    'Export one group as an MCPHub configuration template.',
    async ({ client }, input) => {
      const { groupId } = groupIdSchema.parse(input);
      return client.templates.exportGroup(groupId);
    },
    groupIdSchema,
  ),
  defineTool('mcphub_get_user_stats', 'Get user statistics from MCPHub.', async ({ client }) =>
    client.users.getStats(),
  ),
  defineTool(
    'mcphub_get_runtime_config',
    'Get the runtime config exposed by MCPHub.',
    async ({ client }) => client.publicConfig.getRuntimeConfig(),
  ),
  defineTool(
    'mcphub_list_discovery_categories',
    'List discovery catalog categories.',
    async ({ client }) => client.discovery.listCategories(),
  ),
  defineTool(
    'mcphub_list_discovery_servers',
    'List discovery catalog servers.',
    async ({ client }) => client.discovery.listServers(),
  ),
  defineTool(
    'mcphub_get_discovery_server',
    'Get one discovery catalog server by name.',
    async ({ client }, input) => {
      const { name } = byNameSchema.parse(input);
      return client.discovery.getServer(name);
    },
    byNameSchema,
  ),
  defineTool(
    'mcphub_get_discovery_server_install',
    'Get installation instructions for one discovery catalog server.',
    async ({ client }, input) => {
      const { name } = byNameSchema.parse(input);
      return client.discovery.getServerInstall(name);
    },
    byNameSchema,
  ),
  defineTool('mcphub_list_discovery_tags', 'List discovery catalog tags.', async ({ client }) =>
    client.discovery.listTags(),
  ),
  defineTool('mcphub_health_check', 'Run the MCPHub health check endpoint.', async ({ client }) =>
    client.health.check(),
  ),
  defineTool(
    'mcphub_get_public_config',
    'Get the public MCPHub configuration snapshot.',
    async ({ client }) => client.publicConfig.getSnapshot(),
  ),
];

const ADMIN_AND_ALL_TOOLS: ManagedToolDefinition[] = [
  defineTool(
    'mcphub_cleanup_activities',
    'Delete accumulated activity records.',
    async ({ client }, input) => {
      confirmActionSchema.parse(input);
      return client.activities.cleanup();
    },
    confirmActionSchema,
  ),
  defineTool(
    'mcphub_list_bearer_keys',
    'List MCPHub bearer keys.',
    async ({ client }) => client.bearerKeys.list(),
    undefined,
    (flags) => flags.allowAuthAdminTools,
    ['allowAuthAdminTools'],
  ),
  defineTool(
    'mcphub_create_bearer_key',
    'Create a new MCPHub bearer key.',
    async ({ client }, input) => client.bearerKeys.create(createBearerKeySchema.parse(input)),
    createBearerKeySchema,
    (flags) => flags.allowAuthAdminTools,
    ['allowAuthAdminTools'],
  ),
  defineTool(
    'mcphub_delete_bearer_key',
    'Delete a bearer key.',
    async ({ client }, input) => {
      const parsed = confirmByIdSchema.parse(input);
      assertExpectedValue(parsed.id, parsed.expectedId, 'bearer key id');
      return client.bearerKeys.delete(parsed.id);
    },
    confirmByIdSchema,
    (flags) => flags.allowAuthAdminTools,
    ['allowAuthAdminTools'],
  ),
  defineTool(
    'mcphub_update_bearer_key',
    'Update a bearer key.',
    async ({ client }, input) => {
      const parsed = updateBearerKeySchema.parse(input);
      return client.bearerKeys.update(parsed.id, parsed.body);
    },
    updateBearerKeySchema,
    (flags) => flags.allowAuthAdminTools,
    ['allowAuthAdminTools'],
  ),
  defineTool(
    'mcphub_call_cloud_tool',
    'Call a cloud marketplace tool through MCPHub.',
    async ({ client }, input) => {
      const parsed = z
        .object({
          body: looseObjectSchema.describe('Cloud tool call payload.'),
          serverName: nonEmptyStringSchema.describe('Cloud server name.'),
          toolName: nonEmptyStringSchema.describe('Cloud tool name.'),
        })
        .parse(input);

      return client.cloud.callTool(parsed.serverName, parsed.toolName, parsed.body);
    },
    z.object({
      body: looseObjectSchema.describe('Cloud tool call payload.'),
      serverName: nonEmptyStringSchema.describe('Cloud server name.'),
      toolName: nonEmptyStringSchema.describe('Cloud tool name.'),
    }),
  ),
  defineTool(
    'mcphub_create_group',
    'Create a new MCPHub group.',
    async ({ client }, input) => client.groups.create(createGroupSchema.parse(input)),
    createGroupSchema,
  ),
  defineTool(
    'mcphub_delete_group',
    'Delete a group.',
    async ({ client }, input) => {
      const parsed = confirmByGroupIdSchema.parse(input);
      assertExpectedValue(parsed.groupId, parsed.expectedGroupId, 'group id');
      return client.groups.delete(parsed.groupId);
    },
    confirmByGroupIdSchema,
  ),
  defineTool(
    'mcphub_update_group',
    'Update a group.',
    async ({ client }, input) => {
      const parsed = updateGroupSchema.parse(input);
      return client.groups.update(parsed.groupId, parsed.body);
    },
    updateGroupSchema,
  ),
  defineTool(
    'mcphub_batch_create_groups',
    'Create multiple groups in one request.',
    async ({ client }, input) =>
      client.groups.batchCreate({ groups: createLooseArraySchema.parse(input) }),
    createLooseArraySchema,
  ),
  defineTool(
    'mcphub_clear_logs',
    'Delete MCPHub log entries.',
    async ({ client }, input) => {
      confirmActionSchema.parse(input);
      return client.logs.clear();
    },
    confirmActionSchema,
  ),
  defineTool(
    'mcphub_upload_mcpb_bundle',
    'Upload an MCPB bundle to MCPHub.',
    async ({ client }, input) => {
      const parsed = mcpbUploadSchema.parse(input);
      const formData = new FormData();
      const buffer = Buffer.from(parsed.contentBase64, 'base64');
      const blob = new Blob([buffer], {
        ...(parsed.mimeType !== undefined ? { type: parsed.mimeType } : {}),
      });
      formData.set('bundle', blob, parsed.filename);
      return client.mcpb.upload(formData);
    },
    mcpbUploadSchema,
    (flags) => flags.allowMcpbUpload,
    ['allowMcpbUpload'],
  ),
  defineTool(
    'mcphub_list_oauth_clients',
    'List OAuth clients.',
    async ({ client }) => client.oauthClients.list(),
    undefined,
    (flags) => flags.allowAuthAdminTools,
    ['allowAuthAdminTools'],
  ),
  defineTool(
    'mcphub_create_oauth_client',
    'Create an OAuth client.',
    async ({ client }, input) => client.oauthClients.create(createOAuthClientSchema.parse(input)),
    createOAuthClientSchema,
    (flags) => flags.allowAuthAdminTools,
    ['allowAuthAdminTools'],
  ),
  defineTool(
    'mcphub_delete_oauth_client',
    'Delete an OAuth client.',
    async ({ client }, input) => {
      const parsed = confirmActionSchema
        .extend({
          clientId: nonEmptyStringSchema.describe('OAuth client identifier.'),
          expectedClientId: nonEmptyStringSchema.describe(
            'Required safety check for the target client id.',
          ),
        })
        .parse(input);

      assertExpectedValue(parsed.clientId, parsed.expectedClientId, 'oauth client id');
      return client.oauthClients.delete(parsed.clientId);
    },
    confirmActionSchema.extend({
      clientId: nonEmptyStringSchema.describe('OAuth client identifier.'),
      expectedClientId: nonEmptyStringSchema.describe(
        'Required safety check for the target client id.',
      ),
    }),
    (flags) => flags.allowAuthAdminTools,
    ['allowAuthAdminTools'],
  ),
  defineTool(
    'mcphub_get_oauth_client',
    'Get an OAuth client.',
    async ({ client }, input) => {
      const { clientId } = oauthClientIdSchema.parse(input);
      return client.oauthClients.get(clientId);
    },
    oauthClientIdSchema,
    (flags) => flags.allowAuthAdminTools,
    ['allowAuthAdminTools'],
  ),
  defineTool(
    'mcphub_update_oauth_client',
    'Update an OAuth client.',
    async ({ client }, input) => {
      const parsed = updateOAuthClientSchema.parse(input);
      return client.oauthClients.update(parsed.clientId, parsed.body);
    },
    updateOAuthClientSchema,
    (flags) => flags.allowAuthAdminTools,
    ['allowAuthAdminTools'],
  ),
  defineTool(
    'mcphub_regenerate_oauth_client_secret',
    'Regenerate an OAuth client secret.',
    async ({ client }, input) => {
      const parsed = regenerateOAuthClientSecretSchema.parse(input);
      assertExpectedValue(parsed.clientId, parsed.expectedClientId, 'oauth client id');
      return client.oauthClients.regenerateSecret(parsed.clientId);
    },
    regenerateOAuthClientSecretSchema,
    (flags) => flags.allowAuthAdminTools,
    ['allowAuthAdminTools'],
  ),
  defineTool(
    'mcphub_create_builtin_prompt',
    'Create a built-in prompt.',
    async ({ client }, input) => client.builtinPrompts.create(createPromptSchema.parse(input)),
    createPromptSchema,
  ),
  defineTool(
    'mcphub_delete_builtin_prompt',
    'Delete a built-in prompt.',
    async ({ client }, input) => {
      const parsed = confirmByIdSchema.parse(input);
      assertExpectedValue(parsed.id, parsed.expectedId, 'prompt id');
      return client.builtinPrompts.delete(parsed.id);
    },
    confirmByIdSchema,
  ),
  defineTool(
    'mcphub_create_builtin_resource',
    'Create a built-in resource.',
    async ({ client }, input) => client.builtinResources.create(createResourceSchema.parse(input)),
    createResourceSchema,
  ),
  defineTool(
    'mcphub_delete_builtin_resource',
    'Delete a built-in resource.',
    async ({ client }, input) => {
      const parsed = confirmByIdSchema.parse(input);
      assertExpectedValue(parsed.id, parsed.expectedId, 'resource id');
      return client.builtinResources.delete(parsed.id);
    },
    confirmByIdSchema,
  ),
  defineTool(
    'mcphub_create_server',
    'Create a new MCPHub server.',
    async ({ client, featureFlags }, input) => {
      const body = createServerSchema.parse(input);
      validateServerMutationPayload(body, featureFlags);
      return client.servers.create(body);
    },
    createServerSchema,
  ),
  defineTool(
    'mcphub_delete_server',
    'Delete a server.',
    async ({ client }, input) => {
      const parsed = confirmByNameSchema.parse(input);
      assertExpectedValue(parsed.name, parsed.expectedName, 'server name');
      return client.servers.delete(parsed.name);
    },
    confirmByNameSchema,
  ),
  defineTool(
    'mcphub_update_server',
    'Update a server.',
    async ({ client, featureFlags }, input) => {
      const parsed = updateServerSchema.parse(input);
      validateServerMutationPayload(parsed.body, featureFlags);
      return client.servers.update(parsed.name, parsed.body);
    },
    updateServerSchema,
  ),
  defineTool(
    'mcphub_batch_create_servers',
    'Create multiple servers in one request.',
    async ({ client, featureFlags }, input) => {
      const bodies = createLooseArraySchema.parse(input);
      for (const body of bodies) {
        validateServerMutationPayload(body, featureFlags);
      }

      return client.servers.batchCreate(bodies);
    },
    createLooseArraySchema,
  ),
  defineTool(
    'mcphub_update_system_config',
    'Update MCPHub system configuration.',
    async ({ client }, input) => {
      const parsed = systemConfigUpdateSchema.parse(input);
      const { confirm, expectedOperation, reason, ...body } = parsed;
      void confirm;
      void expectedOperation;
      void reason;
      return client.system.updateConfig(body);
    },
    systemConfigUpdateSchema,
    (flags) => flags.allowSystemConfigWrite,
    ['allowSystemConfigWrite'],
  ),
  defineTool(
    'mcphub_import_config_template',
    'Import an MCPHub configuration template.',
    async ({ client }, input) => {
      const parsed = importConfigTemplateSchema.parse(input);
      const { confirm, expectedOperation, reason, ...body } = parsed;
      void confirm;
      void expectedOperation;
      void reason;
      return client.templates.importConfig(body);
    },
    importConfigTemplateSchema,
  ),
  defineTool(
    'mcphub_list_users',
    'List MCPHub users.',
    async ({ client }) => client.users.list(),
    undefined,
    (flags) => flags.allowAuthAdminTools,
    ['allowAuthAdminTools'],
  ),
  defineTool(
    'mcphub_create_user',
    'Create a user.',
    async ({ client }, input) => client.users.create(createUserSchema.parse(input)),
    createUserSchema,
    (flags) => flags.allowAuthAdminTools,
    ['allowAuthAdminTools'],
  ),
  defineTool(
    'mcphub_delete_user',
    'Delete a user.',
    async ({ client }, input) => {
      const parsed = confirmByUsernameSchema.parse(input);
      assertExpectedValue(parsed.username, parsed.expectedUsername, 'username');
      return client.users.delete(parsed.username);
    },
    confirmByUsernameSchema,
    (flags) => flags.allowAuthAdminTools,
    ['allowAuthAdminTools'],
  ),
  defineTool(
    'mcphub_get_user',
    'Get a user.',
    async ({ client }, input) => {
      const parsed = z
        .object({
          username: nonEmptyStringSchema.describe('Target username.'),
        })
        .parse(input);
      return client.users.get(parsed.username);
    },
    z.object({
      username: nonEmptyStringSchema.describe('Target username.'),
    }),
    (flags) => flags.allowAuthAdminTools,
    ['allowAuthAdminTools'],
  ),
  defineTool(
    'mcphub_update_user',
    'Update a user.',
    async ({ client }, input) => {
      const parsed = updateUserSchema.parse(input);
      return client.users.update(parsed.username, parsed.body);
    },
    updateUserSchema,
    (flags) => flags.allowAuthAdminTools,
    ['allowAuthAdminTools'],
  ),
];

const ALL_MANAGED_TOOLS = [...SAFE_AND_OPS_TOOLS, ...ADMIN_AND_ALL_TOOLS];

export type CreateToolRegistryOptions = {
  client: McpHubClient;
  featureFlags?: Partial<ToolFeatureFlags> | undefined;
  redactor?: Redactor;
};

export const DEFAULT_TOOL_FEATURE_FLAGS: ToolFeatureFlags = {
  allowAuthAdminTools: false,
  allowMcpbUpload: false,
  allowStdioServerCreate: false,
  allowSystemConfigWrite: false,
  allowedTargetHosts: [],
  forceReadonly: false,
};

function normalizeFeatureFlags(flags: Partial<ToolFeatureFlags> | undefined): ToolFeatureFlags {
  return {
    ...DEFAULT_TOOL_FEATURE_FLAGS,
    ...flags,
  };
}

function filterEnabledTools(
  tools: readonly ManagedToolDefinition[],
  profile: ExposureProfile,
  flags: ToolFeatureFlags,
): ManagedToolDefinition[] {
  return tools.filter((tool) => {
    const toolProfile = tool.coverage.profile as ExposureProfile;
    if (!isProfileAllowed(profile, toolProfile)) {
      return false;
    }

    if (
      flags.forceReadonly &&
      tool.coverage.risk !== 'read' &&
      tool.coverage.risk !== 'secret_sensitive'
    ) {
      return false;
    }

    return tool.isEnabled?.(flags) ?? true;
  });
}

export function listManagedToolsForProfile(
  profile: ExposureProfile,
  featureFlags?: Partial<ToolFeatureFlags>,
): ManagedToolDefinition[] {
  return filterEnabledTools(ALL_MANAGED_TOOLS, profile, normalizeFeatureFlags(featureFlags));
}

export function createToolRegistry(options: CreateToolRegistryOptions) {
  const redactor = options.redactor ?? createRedactor();
  const featureFlags = normalizeFeatureFlags(options.featureFlags);
  const context: ToolExecutionContext = {
    client: options.client,
    featureFlags,
    redactor,
  };

  return {
    list(profile: ExposureProfile): ManagedToolDefinition[] {
      return listManagedToolsForProfile(profile, featureFlags);
    },
    async execute(
      profile: ExposureProfile,
      toolName: string,
      input: unknown,
    ): Promise<StructuredToolResult> {
      const tool = listManagedToolsForProfile(profile, featureFlags).find(
        (candidate) => candidate.name === toolName,
      );
      if (tool === undefined) {
        throw new Error(`Unknown tool "${toolName}" for profile "${profile}".`);
      }

      return tool.execute(context, input);
    },
  };
}
