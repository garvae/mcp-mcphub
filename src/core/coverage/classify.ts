// SPDX-License-Identifier: Apache-2.0

import type { CoverageClassification, CoverageEntry, ExposureProfile, RiskClass, SnapshotRoute } from './types.js';

function createCoverageEntry(
  route: SnapshotRoute,
  metadata: {
    classification: CoverageClassification;
    mcpKind?: CoverageEntry['mcp']['kind'];
    mcpName?: string;
    notes: string;
    profile?: ExposureProfile;
    risk?: RiskClass;
  },
): CoverageEntry {
  return {
    authenticated: route.authenticated,
    classification: metadata.classification,
    handlerName: route.handlerName,
    line: route.line,
    mcp: {
      kind: metadata.mcpKind ?? 'tool',
      name: metadata.mcpName ?? null,
    },
    method: route.method,
    notes: metadata.notes,
    path: route.fullPath,
    profile: metadata.profile ?? null,
    risk: metadata.risk ?? null,
    sourceFile: route.sourceFile,
    sinceMcphubVersion: '1.0.15',
  };
}

function classifyServerRoute(route: SnapshotRoute): CoverageEntry {
  if (route.fullPath === '/api/servers' && route.method === 'GET') {
    return createCoverageEntry(route, {
      classification: 'safe',
      mcpName: 'mcphub_list_servers',
      notes: 'Lists MCPHub server definitions with secret-bearing fields redacted in tool output.',
      profile: 'safe',
      risk: 'read',
    });
  }

  if (route.fullPath === '/api/servers' && route.method === 'POST') {
    return createCoverageEntry(route, {
      classification: 'admin',
      mcpName: 'mcphub_create_server',
      notes: 'Creates a server definition; stdio command-based servers remain gated by policy flags.',
      profile: 'admin',
      risk: 'destructive',
    });
  }

  if (route.fullPath === '/api/servers/batch' && route.method === 'POST') {
    return createCoverageEntry(route, {
      classification: 'admin',
      mcpName: 'mcphub_batch_create_servers',
      notes: 'Batch server creation remains destructive because it mutates managed infrastructure at scale.',
      profile: 'admin',
      risk: 'destructive',
    });
  }

  if (route.fullPath === '/api/servers/:name' && route.method === 'GET') {
    return createCoverageEntry(route, {
      classification: 'safe',
      mcpName: 'mcphub_get_server',
      notes: 'Returns a single server configuration with secret-bearing fields redacted.',
      profile: 'safe',
      risk: 'read',
    });
  }

  if (route.fullPath === '/api/servers/:name' && route.method === 'PUT') {
    return createCoverageEntry(route, {
      classification: 'admin',
      mcpName: 'mcphub_update_server',
      notes: 'Updates server configuration and requires destructive-style confirmation because a bad update can disable service access.',
      profile: 'admin',
      risk: 'destructive',
    });
  }

  if (route.fullPath === '/api/servers/:name' && route.method === 'DELETE') {
    return createCoverageEntry(route, {
      classification: 'admin',
      mcpName: 'mcphub_delete_server',
      notes: 'Deleting a server is destructive and must require explicit confirmation fields.',
      profile: 'admin',
      risk: 'destructive',
    });
  }

  if (route.fullPath === '/api/servers/:name/toggle' && route.method === 'POST') {
    return createCoverageEntry(route, {
      classification: 'ops',
      mcpName: 'mcphub_toggle_server',
      notes: 'Enable or disable a managed server without deleting it; dry-run support should be preserved in the MCP layer.',
      profile: 'ops',
      risk: 'safe_write',
    });
  }

  if (route.fullPath === '/api/servers/:name/reload' && route.method === 'POST') {
    return createCoverageEntry(route, {
      classification: 'ops',
      mcpName: 'mcphub_reload_server',
      notes: 'Reload is operational and reversible but still affects active sessions.',
      profile: 'ops',
      risk: 'safe_write',
    });
  }

  if (route.fullPath.startsWith('/api/servers/:serverName/tools/')) {
    if (route.method === 'POST') {
      return createCoverageEntry(route, {
        classification: 'ops',
        mcpName: 'mcphub_toggle_server_tool',
        notes: 'Toggles a downstream tool inside a managed server definition.',
        profile: 'ops',
        risk: 'safe_write',
      });
    }

    if (route.method === 'PUT') {
      return createCoverageEntry(route, {
        classification: 'ops',
        mcpName: 'mcphub_update_server_tool_description',
        notes: 'Description overrides affect agent behavior and therefore stay in the ops profile with audit context.',
        profile: 'ops',
        risk: 'safe_write',
      });
    }

    return createCoverageEntry(route, {
      classification: 'ops',
      mcpName: 'mcphub_reset_server_tool_description',
      notes: 'Resets server tool description overrides to upstream defaults.',
      profile: 'ops',
      risk: 'safe_write',
    });
  }

  if (route.fullPath.startsWith('/api/servers/:serverName/prompts/')) {
    if (route.method === 'POST') {
      return createCoverageEntry(route, {
        classification: 'ops',
        mcpName: 'mcphub_toggle_server_prompt',
        notes: 'Toggles a downstream prompt inside a managed server definition.',
        profile: 'ops',
        risk: 'safe_write',
      });
    }

    if (route.method === 'PUT') {
      return createCoverageEntry(route, {
        classification: 'ops',
        mcpName: 'mcphub_update_server_prompt_description',
        notes: 'Prompt description overrides influence model-facing guidance and remain operational writes.',
        profile: 'ops',
        risk: 'safe_write',
      });
    }

    return createCoverageEntry(route, {
      classification: 'ops',
      mcpName: 'mcphub_reset_server_prompt_description',
      notes: 'Resets server prompt description overrides.',
      profile: 'ops',
      risk: 'safe_write',
    });
  }

  if (route.fullPath.startsWith('/api/servers/:serverName/resources/')) {
    if (route.method === 'POST') {
      return createCoverageEntry(route, {
        classification: 'ops',
        mcpName: 'mcphub_toggle_server_resource',
        notes: 'Toggles a downstream resource inside a managed server definition.',
        profile: 'ops',
        risk: 'safe_write',
      });
    }

    if (route.method === 'PUT') {
      return createCoverageEntry(route, {
        classification: 'ops',
        mcpName: 'mcphub_update_server_resource_description',
        notes: 'Resource description overrides affect model context and stay in the ops profile.',
        profile: 'ops',
        risk: 'safe_write',
      });
    }

    return createCoverageEntry(route, {
      classification: 'ops',
      mcpName: 'mcphub_reset_server_resource_description',
      notes: 'Resets server resource description overrides.',
      profile: 'ops',
      risk: 'safe_write',
    });
  }

  throw new Error(`Unclassified server route: ${route.method} ${route.fullPath}`);
}

function classifyGroupRoute(route: SnapshotRoute): CoverageEntry {
  if (route.fullPath === '/api/groups' && route.method === 'GET') {
    return createCoverageEntry(route, {
      classification: 'safe',
      mcpName: 'mcphub_list_groups',
      notes: 'Lists MCPHub groups and their high-level metadata.',
      profile: 'safe',
      risk: 'read',
    });
  }

  if (route.fullPath === '/api/groups' && route.method === 'POST') {
    return createCoverageEntry(route, {
      classification: 'admin',
      mcpName: 'mcphub_create_group',
      notes: 'Creates a new group and changes routing behavior for downstream tools.',
      profile: 'admin',
      risk: 'destructive',
    });
  }

  if (route.fullPath === '/api/groups/batch' && route.method === 'POST') {
    return createCoverageEntry(route, {
      classification: 'admin',
      mcpName: 'mcphub_batch_create_groups',
      notes: 'Batch group creation is a broad infrastructure mutation and stays destructive.',
      profile: 'admin',
      risk: 'destructive',
    });
  }

  if (route.fullPath === '/api/groups/:id' && route.method === 'GET') {
    return createCoverageEntry(route, {
      classification: 'safe',
      mcpName: 'mcphub_get_group',
      notes: 'Returns a single group definition and summary metadata.',
      profile: 'safe',
      risk: 'read',
    });
  }

  if (route.fullPath === '/api/groups/:id' && route.method === 'PUT') {
    return createCoverageEntry(route, {
      classification: 'admin',
      mcpName: 'mcphub_update_group',
      notes: 'Updates group metadata and membership behavior.',
      profile: 'admin',
      risk: 'destructive',
    });
  }

  if (route.fullPath === '/api/groups/:id' && route.method === 'DELETE') {
    return createCoverageEntry(route, {
      classification: 'admin',
      mcpName: 'mcphub_delete_group',
      notes: 'Deleting a group is destructive and must require explicit confirmation.',
      profile: 'admin',
      risk: 'destructive',
    });
  }

  if (route.fullPath === '/api/groups/:id/servers' && route.method === 'GET') {
    return createCoverageEntry(route, {
      classification: 'safe',
      mcpName: 'mcphub_list_group_servers',
      notes: 'Lists server membership for a single group.',
      profile: 'safe',
      risk: 'read',
    });
  }

  if (route.fullPath === '/api/groups/:id/servers' && route.method === 'POST') {
    return createCoverageEntry(route, {
      classification: 'ops',
      mcpName: 'mcphub_add_server_to_group',
      notes: 'Adds an existing server to a group without changing the server definition itself.',
      profile: 'ops',
      risk: 'safe_write',
    });
  }

  if (route.fullPath === '/api/groups/:id/servers/:serverName' && route.method === 'DELETE') {
    return createCoverageEntry(route, {
      classification: 'ops',
      mcpName: 'mcphub_remove_server_from_group',
      notes: 'Removes a server from a group while preserving the server definition.',
      profile: 'ops',
      risk: 'safe_write',
    });
  }

  if (route.fullPath === '/api/groups/:id/servers/batch' && route.method === 'PUT') {
    return createCoverageEntry(route, {
      classification: 'ops',
      mcpName: 'mcphub_replace_group_servers',
      notes: 'Batch replacement of group membership is operational but broad enough to require careful audit context.',
      profile: 'ops',
      risk: 'safe_write',
    });
  }

  if (route.fullPath === '/api/groups/:id/server-configs' && route.method === 'GET') {
    return createCoverageEntry(route, {
      classification: 'safe',
      mcpName: 'mcphub_get_group_server_configs',
      notes: 'Returns all per-server group overrides for a group.',
      profile: 'safe',
      risk: 'read',
    });
  }

  if (route.fullPath === '/api/groups/:id/server-configs/:serverName' && route.method === 'GET') {
    return createCoverageEntry(route, {
      classification: 'safe',
      mcpName: 'mcphub_get_group_server_config',
      notes: 'Returns a single per-server group configuration override.',
      profile: 'safe',
      risk: 'read',
    });
  }

  if (route.fullPath === '/api/groups/:id/server-configs/:serverName/tools' && route.method === 'PUT') {
    return createCoverageEntry(route, {
      classification: 'ops',
      mcpName: 'mcphub_update_group_server_tools',
      notes: 'Updates group-scoped tool selection for a server.',
      profile: 'ops',
      risk: 'safe_write',
    });
  }

  throw new Error(`Unclassified group route: ${route.method} ${route.fullPath}`);
}

function classifyBuiltinPromptRoute(route: SnapshotRoute): CoverageEntry {
  if (route.fullPath === '/api/prompts' && route.method === 'GET') {
    return createCoverageEntry(route, {
      classification: 'safe',
      mcpName: 'mcphub_list_builtin_prompts',
      notes: 'Lists built-in MCPHub prompts.',
      profile: 'safe',
      risk: 'read',
    });
  }

  if (route.fullPath === '/api/prompts' && route.method === 'POST') {
    return createCoverageEntry(route, {
      classification: 'admin',
      mcpName: 'mcphub_create_builtin_prompt',
      notes: 'Creates a built-in prompt exposed by MCPHub itself.',
      profile: 'admin',
      risk: 'destructive',
    });
  }

  if (route.fullPath === '/api/prompts/:id' && route.method === 'GET') {
    return createCoverageEntry(route, {
      classification: 'safe',
      mcpName: 'mcphub_get_builtin_prompt',
      notes: 'Returns a built-in prompt definition by id.',
      profile: 'safe',
      risk: 'read',
    });
  }

  if (route.fullPath === '/api/prompts/:id' && route.method === 'PUT') {
    return createCoverageEntry(route, {
      classification: 'ops',
      mcpName: 'mcphub_update_builtin_prompt',
      notes: 'Updating a built-in prompt changes model-facing instructions and remains an operational write.',
      profile: 'ops',
      risk: 'safe_write',
    });
  }

  return createCoverageEntry(route, {
    classification: 'admin',
    mcpName: 'mcphub_delete_builtin_prompt',
    notes: 'Deletes a built-in prompt and therefore requires destructive confirmation.',
    profile: 'admin',
    risk: 'destructive',
  });
}

function classifyBuiltinResourceRoute(route: SnapshotRoute): CoverageEntry {
  if (route.fullPath === '/api/resources' && route.method === 'GET') {
    return createCoverageEntry(route, {
      classification: 'safe',
      mcpName: 'mcphub_list_builtin_resources',
      notes: 'Lists built-in MCPHub resources.',
      profile: 'safe',
      risk: 'read',
    });
  }

  if (route.fullPath === '/api/resources' && route.method === 'POST') {
    return createCoverageEntry(route, {
      classification: 'admin',
      mcpName: 'mcphub_create_builtin_resource',
      notes: 'Creates a built-in resource exposed by MCPHub itself.',
      profile: 'admin',
      risk: 'destructive',
    });
  }

  if (route.fullPath === '/api/resources/read' && route.method === 'POST') {
    return createCoverageEntry(route, {
      classification: 'safe',
      mcpName: 'mcphub_read_builtin_resource',
      notes: 'Reads built-in resource content and should stay read-only in the MCP surface.',
      profile: 'safe',
      risk: 'read',
    });
  }

  if (route.fullPath === '/api/resources/:id' && route.method === 'GET') {
    return createCoverageEntry(route, {
      classification: 'safe',
      mcpName: 'mcphub_get_builtin_resource',
      notes: 'Returns a built-in resource definition by id.',
      profile: 'safe',
      risk: 'read',
    });
  }

  if (route.fullPath === '/api/resources/:id' && route.method === 'PUT') {
    return createCoverageEntry(route, {
      classification: 'ops',
      mcpName: 'mcphub_update_builtin_resource',
      notes: 'Updating a built-in resource changes model-visible context and remains an operational write.',
      profile: 'ops',
      risk: 'safe_write',
    });
  }

  return createCoverageEntry(route, {
    classification: 'admin',
    mcpName: 'mcphub_delete_builtin_resource',
    notes: 'Deletes a built-in resource and therefore requires destructive confirmation.',
    profile: 'admin',
    risk: 'destructive',
  });
}

export function classifyRoute(route: SnapshotRoute): CoverageEntry {
  if (route.fullPath.startsWith('/api/servers')) {
    return classifyServerRoute(route);
  }

  if (route.fullPath.startsWith('/api/groups')) {
    return classifyGroupRoute(route);
  }

  if (route.fullPath.startsWith('/api/prompts')) {
    return classifyBuiltinPromptRoute(route);
  }

  if (route.fullPath.startsWith('/api/resources')) {
    return classifyBuiltinResourceRoute(route);
  }

  switch (`${route.method} ${route.fullPath}`) {
    case 'GET /health':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_health_check',
        notes: 'Basic health endpoint for liveness and quick diagnostics.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /config':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_runtime_config',
        notes: 'Public runtime bootstrap configuration for the MCPHub frontend.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /public-config':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_public_config',
        notes: 'Public configuration snapshot; useful for diagnosing skip-auth and similar public flags.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /.well-known/mcp-marketplace':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_marketplace_well_known',
        notes: 'Public discovery metadata for the local marketplace catalog.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /discovery/servers':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_list_discovery_servers',
        notes: 'Public discovery catalog listing for external installers and MCP clients.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /discovery/servers/:name':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_discovery_server',
        notes: 'Public discovery details for a single catalog server.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /discovery/servers/:name/install':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_discovery_server_install',
        notes: 'Public install payload for a discovery server entry.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /discovery/categories':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_list_discovery_categories',
        notes: 'Public discovery categories exposed by MCPHub.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /discovery/tags':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_list_discovery_tags',
        notes: 'Public discovery tags exposed by MCPHub.',
        profile: 'safe',
        risk: 'read',
      });
    case 'POST /internal/v1/events':
      return createCoverageEntry(route, {
        classification: 'internal',
        mcpKind: 'none',
        notes: 'Hosted internal event ingress is not suitable for MCP exposure.',
      });
    case 'GET /internal/v1/hosted/runtime-catalog':
      return createCoverageEntry(route, {
        classification: 'internal',
        mcpKind: 'none',
        notes: 'Hosted internal runtime catalog is HMAC-protected infrastructure plumbing.',
      });
    case 'GET /oauth/callback':
    case 'GET /oauth/authorize':
    case 'POST /oauth/authorize':
    case 'POST /oauth/token':
    case 'GET /oauth/userinfo':
    case 'GET /.well-known/oauth-authorization-server':
    case 'GET /.well-known/oauth-protected-resource':
    case 'POST /oauth/register':
    case 'GET /oauth/register/:clientId':
    case 'PUT /oauth/register/:clientId':
    case 'DELETE /oauth/register/:clientId':
      return createCoverageEntry(route, {
        classification: 'internal',
        mcpKind: 'none',
        notes: 'OAuth authorization-server and dynamic registration routes are intentionally kept out of the management MCP tool surface.',
      });
    case 'GET /api/openapi.json':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_downstream_openapi_spec',
        notes: 'This OpenAPI document describes downstream MCP tool execution, not the management API itself.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/:name/openapi.json':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_group_downstream_openapi_spec',
        notes: 'Group-scoped downstream OpenAPI document for MCPHub tool execution.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/openapi/servers':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_list_openapi_servers',
        notes: 'Lists downstream servers visible to the OpenAPI generator.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/openapi/stats':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_openapi_stats',
        notes: 'OpenAPI generator statistics for downstream tool exposure.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/tools/:serverName/:toolName':
    case 'POST /api/tools/:serverName/:toolName':
    case 'GET /api/:name/tools/:serverName/:toolName':
    case 'POST /api/:name/tools/:serverName/:toolName':
    case 'POST /api/tools/call/:server':
    case 'POST /api/mcp/:serverName/prompts/:promptName':
      return createCoverageEntry(route, {
        classification: 'unsupported',
        mcpKind: 'none',
        notes: 'These routes duplicate MCPHub downstream gateway behavior and are intentionally excluded from the management MCP surface.',
      });
    case 'GET /api/settings':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_settings_snapshot',
        notes: 'Returns a settings snapshot with secrets redacted by default in the MCP output layer.',
        profile: 'safe',
        risk: 'secret_sensitive',
      });
    case 'GET /api/mcp-settings/export':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_export_settings',
        notes: 'Settings export remains secret-sensitive and should only expose redacted content unless explicitly overridden.',
        profile: 'safe',
        risk: 'secret_sensitive',
      });
    case 'PUT /api/system-config':
      return createCoverageEntry(route, {
        classification: 'all',
        mcpName: 'mcphub_update_system_config',
        notes: 'System config writes can lock users out or weaken auth posture and therefore remain all-profile dangerous operations.',
        profile: 'all',
        risk: 'dangerous_config',
      });
    case 'GET /api/cost/servers':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_server_costs',
        notes: 'Returns context footprint cost data for servers.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/cost/groups':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_group_costs',
        notes: 'Returns context footprint cost data for groups.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/users':
      return createCoverageEntry(route, {
        classification: 'admin',
        mcpName: 'mcphub_list_users',
        notes: 'User listings are administrative and should stay behind trusted profiles.',
        profile: 'admin',
        risk: 'read',
      });
    case 'POST /api/users':
      return createCoverageEntry(route, {
        classification: 'admin',
        mcpName: 'mcphub_create_user',
        notes: 'Creating a user mutates access control and remains destructive.',
        profile: 'admin',
        risk: 'destructive',
      });
    case 'GET /api/users-stats':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_user_stats',
        notes: 'User statistics are read-only and useful for diagnostics, even though upstream still requires authenticated access.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/users/:username':
      return createCoverageEntry(route, {
        classification: 'admin',
        mcpName: 'mcphub_get_user',
        notes: 'User record inspection remains administrative because it exposes identity and role data.',
        profile: 'admin',
        risk: 'read',
      });
    case 'PUT /api/users/:username':
      return createCoverageEntry(route, {
        classification: 'admin',
        mcpName: 'mcphub_update_user',
        notes: 'Updating a user changes access control and remains destructive.',
        profile: 'admin',
        risk: 'destructive',
      });
    case 'DELETE /api/users/:username':
      return createCoverageEntry(route, {
        classification: 'admin',
        mcpName: 'mcphub_delete_user',
        notes: 'Deleting a user is destructive and must require explicit confirmation.',
        profile: 'admin',
        risk: 'destructive',
      });
    case 'GET /api/oauth/clients':
      return createCoverageEntry(route, {
        classification: 'admin',
        mcpName: 'mcphub_list_oauth_clients',
        notes: 'OAuth client management is administrative and secret-sensitive.',
        profile: 'admin',
        risk: 'dangerous_config',
      });
    case 'POST /api/oauth/clients':
      return createCoverageEntry(route, {
        classification: 'admin',
        mcpName: 'mcphub_create_oauth_client',
        notes: 'Creating an OAuth client introduces new credentials and remains dangerous configuration.',
        profile: 'admin',
        risk: 'dangerous_config',
      });
    case 'GET /api/oauth/clients/:clientId':
      return createCoverageEntry(route, {
        classification: 'admin',
        mcpName: 'mcphub_get_oauth_client',
        notes: 'OAuth client inspection remains administrative because secrets and redirect URIs require careful redaction.',
        profile: 'admin',
        risk: 'dangerous_config',
      });
    case 'PUT /api/oauth/clients/:clientId':
      return createCoverageEntry(route, {
        classification: 'admin',
        mcpName: 'mcphub_update_oauth_client',
        notes: 'Updating OAuth client configuration can break auth flows and is classified as dangerous configuration.',
        profile: 'admin',
        risk: 'dangerous_config',
      });
    case 'DELETE /api/oauth/clients/:clientId':
      return createCoverageEntry(route, {
        classification: 'admin',
        mcpName: 'mcphub_delete_oauth_client',
        notes: 'Deleting an OAuth client is destructive and changes auth posture.',
        profile: 'admin',
        risk: 'dangerous_config',
      });
    case 'POST /api/oauth/clients/:clientId/regenerate-secret':
      return createCoverageEntry(route, {
        classification: 'all',
        mcpName: 'mcphub_regenerate_oauth_client_secret',
        notes: 'Secret regeneration is highly sensitive because it invalidates existing integrations immediately.',
        profile: 'all',
        risk: 'dangerous_config',
      });
    case 'GET /api/auth/keys':
      return createCoverageEntry(route, {
        classification: 'admin',
        mcpName: 'mcphub_list_bearer_keys',
        notes: 'Bearer key listings are secret-sensitive and remain administrative.',
        profile: 'admin',
        risk: 'dangerous_config',
      });
    case 'POST /api/auth/keys':
      return createCoverageEntry(route, {
        classification: 'admin',
        mcpName: 'mcphub_create_bearer_key',
        notes: 'Creating a bearer key changes control-plane access and remains dangerous configuration.',
        profile: 'admin',
        risk: 'dangerous_config',
      });
    case 'PUT /api/auth/keys/:id':
      return createCoverageEntry(route, {
        classification: 'admin',
        mcpName: 'mcphub_update_bearer_key',
        notes: 'Updating bearer key properties changes privileged API access.',
        profile: 'admin',
        risk: 'dangerous_config',
      });
    case 'DELETE /api/auth/keys/:id':
      return createCoverageEntry(route, {
        classification: 'admin',
        mcpName: 'mcphub_delete_bearer_key',
        notes: 'Deleting a bearer key is destructive for existing clients and remains dangerous configuration.',
        profile: 'admin',
        risk: 'dangerous_config',
      });
    case 'GET /api/activities/available':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_check_activities_available',
        notes: 'Reports whether activity endpoints are available on the current MCPHub instance.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/activities':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_list_activities',
        notes: 'Lists activity records when MCPHub runs in database mode.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/activities/stats':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_activity_stats',
        notes: 'Returns aggregate activity statistics in database mode.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/activities/filters':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_activity_filters',
        notes: 'Returns available filter values for the activity feed.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/activities/:id':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_activity',
        notes: 'Returns a single activity record by id.',
        profile: 'safe',
        risk: 'read',
      });
    case 'DELETE /api/activities/cleanup':
      return createCoverageEntry(route, {
        classification: 'admin',
        mcpName: 'mcphub_cleanup_activities',
        notes: 'Activity cleanup deletes history and therefore remains destructive.',
        profile: 'admin',
        risk: 'destructive',
      });
    case 'POST /api/templates/export':
      return createCoverageEntry(route, {
        classification: 'ops',
        mcpName: 'mcphub_export_config_template',
        notes: 'Exports a configuration template for operational reuse.',
        profile: 'ops',
        risk: 'safe_write',
      });
    case 'GET /api/templates/export/groups/:id':
      return createCoverageEntry(route, {
        classification: 'ops',
        mcpName: 'mcphub_export_group_template',
        notes: 'Exports a group as a reusable configuration template.',
        profile: 'ops',
        risk: 'safe_write',
      });
    case 'POST /api/templates/import':
      return createCoverageEntry(route, {
        classification: 'all',
        mcpName: 'mcphub_import_config_template',
        notes: 'Template import can introduce arbitrary server definitions and remains dangerous configuration.',
        profile: 'all',
        risk: 'dangerous_config',
      });
    case 'GET /api/better-auth/user':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_better_auth_user',
        notes: 'Returns the resolved Better Auth user for the current request when Better Auth is enabled.',
        profile: 'safe',
        risk: 'read',
      });
    case 'POST /api/auth/login':
    case 'POST /api/auth/register':
    case 'POST /api/auth/change-password':
      return createCoverageEntry(route, {
        classification: 'internal',
        mcpKind: 'none',
        notes: 'Authentication mutation routes are used by the REST client in JWT mode but are not exposed as management tools.',
      });
    case 'GET /api/auth/user':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_current_user',
        notes: 'Returns the current authenticated MCPHub user.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/market/servers':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_list_market_servers',
        notes: 'Lists local market catalog servers.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/market/servers/search':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_search_market_servers',
        notes: 'Searches market catalog servers by query string.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/market/servers/:name':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_market_server',
        notes: 'Returns a single market catalog entry.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/market/categories':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_list_market_categories',
        notes: 'Lists market categories.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/market/categories/:category':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_market_servers_by_category',
        notes: 'Lists market servers for a category.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/market/tags':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_list_market_tags',
        notes: 'Lists market tags.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/market/tags/:tag':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_market_servers_by_tag',
        notes: 'Lists market servers for a tag.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/cloud/servers':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_list_cloud_servers',
        notes: 'Lists cloud market servers.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/cloud/servers/search':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_search_cloud_servers',
        notes: 'Searches cloud market servers by query string.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/cloud/servers/:name':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_cloud_server',
        notes: 'Returns a single cloud market entry.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/cloud/categories':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_list_cloud_categories',
        notes: 'Lists cloud market categories.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/cloud/categories/:category':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_cloud_servers_by_category',
        notes: 'Lists cloud market servers for a category.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/cloud/tags':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_list_cloud_tags',
        notes: 'Lists cloud market tags.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/cloud/tags/:tag':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_cloud_servers_by_tag',
        notes: 'Lists cloud market servers for a tag.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/cloud/servers/:serverName/tools':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_cloud_server_tools',
        notes: 'Lists callable tools for a cloud market server.',
        profile: 'safe',
        risk: 'read',
      });
    case 'POST /api/cloud/servers/:serverName/tools/:toolName/call':
      return createCoverageEntry(route, {
        classification: 'all',
        mcpName: 'mcphub_call_cloud_tool',
        notes: 'Calling a cloud market tool is intentionally reserved for the all profile because it crosses into downstream execution.',
        profile: 'all',
        risk: 'dangerous_config',
      });
    case 'GET /api/registry/servers':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_list_registry_servers',
        notes: 'Lists MCP registry entries proxied by MCPHub.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/registry/servers/versions':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_registry_server_versions',
        notes: 'Returns available versions for a registry server entry.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/registry/servers/version':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_registry_server_version',
        notes: 'Returns a specific registry server version payload.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/changelog/update-info':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_changelog_update_info',
        notes: 'Returns MCPHub update metadata proxied from the changelog service.',
        profile: 'safe',
        risk: 'read',
      });
    case 'GET /api/logs':
      return createCoverageEntry(route, {
        classification: 'safe',
        mcpName: 'mcphub_get_logs',
        notes: 'Returns MCPHub logs and must redact tokens, headers, and environment values.',
        profile: 'safe',
        risk: 'secret_sensitive',
      });
    case 'DELETE /api/logs':
      return createCoverageEntry(route, {
        classification: 'admin',
        mcpName: 'mcphub_clear_logs',
        notes: 'Log clearing is destructive because it deletes audit evidence.',
        profile: 'admin',
        risk: 'destructive',
      });
    case 'GET /api/logs/stream':
      return createCoverageEntry(route, {
        classification: 'streaming-only',
        mcpKind: 'none',
        notes: 'Log streaming should be modeled as a future MCP resource subscription, not a request/response tool.',
      });
    case 'POST /api/mcpb/upload':
      return createCoverageEntry(route, {
        classification: 'all',
        mcpName: 'mcphub_upload_mcpb_bundle',
        notes: 'MCPB upload accepts multipart content and remains dangerous configuration.',
        profile: 'all',
        risk: 'dangerous_config',
      });
    default:
      throw new Error(`Unclassified route: ${route.method} ${route.fullPath}`);
  }
}
