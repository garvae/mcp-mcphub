# Tool Catalog

This document is the curated human overview of the current `mcphub_*` tools by product area.

For generated profile-specific catalogs and JSON exports, see [generated/README.md](./generated/README.md).
For the exact endpoint mapping, see [api-coverage.md](./api-coverage.md).

## Risk Legend

- `read`: read-only endpoint
- `safe_write`: operational or reversible change
- `destructive`: deletion or non-trivial mutation
- `dangerous_config`: high-trust configuration or credential surface
- `secret_sensitive`: read endpoint whose payload may contain sensitive data before redaction

## Platform and Discovery

| Tool                                  | Profile | Risk   | Notes                           |
| ------------------------------------- | ------- | ------ | ------------------------------- |
| `mcphub_health_check`                 | `safe`  | `read` | Upstream `/health`              |
| `mcphub_get_public_config`            | `safe`  | `read` | Public config snapshot          |
| `mcphub_get_runtime_config`           | `safe`  | `read` | Runtime `/config` endpoint      |
| `mcphub_get_marketplace_well_known`   | `safe`  | `read` | Public marketplace manifest     |
| `mcphub_list_discovery_categories`    | `safe`  | `read` | Discovery metadata              |
| `mcphub_list_discovery_servers`       | `safe`  | `read` | Discovery catalog list          |
| `mcphub_get_discovery_server`         | `safe`  | `read` | One discovery server            |
| `mcphub_get_discovery_server_install` | `safe`  | `read` | Install guidance from discovery |
| `mcphub_list_discovery_tags`          | `safe`  | `read` | Discovery tags                  |

## Activities and Logs

| Tool                                | Profile | Risk               | Notes                                    |
| ----------------------------------- | ------- | ------------------ | ---------------------------------------- |
| `mcphub_check_activities_available` | `safe`  | `read`             | Detect file-mode vs db-mode availability |
| `mcphub_list_activities`            | `safe`  | `read`             | Optional pagination and search           |
| `mcphub_get_activity`               | `safe`  | `read`             | One activity record                      |
| `mcphub_get_activity_filters`       | `safe`  | `read`             | Available filters                        |
| `mcphub_get_activity_stats`         | `safe`  | `read`             | Aggregate activity metrics               |
| `mcphub_cleanup_activities`         | `admin` | `destructive`      | Requires confirmation                    |
| `mcphub_get_logs`                   | `safe`  | `secret_sensitive` | Redacted log payloads                    |
| `mcphub_clear_logs`                 | `admin` | `destructive`      | Requires confirmation                    |

## Auth and Identity

| Tool                                    | Profile | Risk               | Notes                               |
| --------------------------------------- | ------- | ------------------ | ----------------------------------- |
| `mcphub_get_current_user`               | `safe`  | `read`             | Current management identity         |
| `mcphub_get_better_auth_user`           | `safe`  | `read`             | Upstream Better Auth current user   |
| `mcphub_list_bearer_keys`               | `admin` | `dangerous_config` | Flagged by `ALLOW_AUTH_ADMIN_TOOLS` |
| `mcphub_create_bearer_key`              | `admin` | `dangerous_config` | Flagged by `ALLOW_AUTH_ADMIN_TOOLS` |
| `mcphub_update_bearer_key`              | `admin` | `dangerous_config` | Flagged by `ALLOW_AUTH_ADMIN_TOOLS` |
| `mcphub_delete_bearer_key`              | `admin` | `dangerous_config` | Confirmation + flag                 |
| `mcphub_list_oauth_clients`             | `admin` | `dangerous_config` | Flagged by `ALLOW_AUTH_ADMIN_TOOLS` |
| `mcphub_create_oauth_client`            | `admin` | `dangerous_config` | Flagged by `ALLOW_AUTH_ADMIN_TOOLS` |
| `mcphub_get_oauth_client`               | `admin` | `dangerous_config` | Flagged by `ALLOW_AUTH_ADMIN_TOOLS` |
| `mcphub_update_oauth_client`            | `admin` | `dangerous_config` | Flagged by `ALLOW_AUTH_ADMIN_TOOLS` |
| `mcphub_delete_oauth_client`            | `admin` | `dangerous_config` | Confirmation + flag                 |
| `mcphub_regenerate_oauth_client_secret` | `all`   | `dangerous_config` | Confirmation + flag                 |
| `mcphub_list_users`                     | `admin` | `read`             | Flagged by `ALLOW_AUTH_ADMIN_TOOLS` |
| `mcphub_get_user`                       | `admin` | `read`             | Flagged by `ALLOW_AUTH_ADMIN_TOOLS` |
| `mcphub_get_user_stats`                 | `safe`  | `read`             | User aggregate metrics              |
| `mcphub_create_user`                    | `admin` | `destructive`      | Flagged by `ALLOW_AUTH_ADMIN_TOOLS` |
| `mcphub_update_user`                    | `admin` | `destructive`      | Flagged by `ALLOW_AUTH_ADMIN_TOOLS` |
| `mcphub_delete_user`                    | `admin` | `destructive`      | Confirmation + flag                 |

## Servers

| Tool                          | Profile | Risk          | Notes                         |
| ----------------------------- | ------- | ------------- | ----------------------------- |
| `mcphub_list_servers`         | `safe`  | `read`        | Server inventory              |
| `mcphub_get_server`           | `safe`  | `read`        | One server                    |
| `mcphub_create_server`        | `admin` | `destructive` | SSRF and stdio-command checks |
| `mcphub_update_server`        | `admin` | `destructive` | SSRF and stdio-command checks |
| `mcphub_delete_server`        | `admin` | `destructive` | Confirmation required         |
| `mcphub_batch_create_servers` | `admin` | `destructive` | Batch server creation         |
| `mcphub_reload_server`        | `ops`   | `safe_write`  | Reload without recreate       |
| `mcphub_toggle_server`        | `ops`   | `safe_write`  | Enable/disable toggle         |

## Server Tool, Prompt, and Resource Overrides

| Tool                                        | Profile | Risk         | Notes                    |
| ------------------------------------------- | ------- | ------------ | ------------------------ |
| `mcphub_toggle_server_tool`                 | `ops`   | `safe_write` | Tool enable/disable      |
| `mcphub_update_server_tool_description`     | `ops`   | `safe_write` | Description lint applied |
| `mcphub_reset_server_tool_description`      | `ops`   | `safe_write` | Clears override          |
| `mcphub_toggle_server_prompt`               | `ops`   | `safe_write` | Prompt enable/disable    |
| `mcphub_update_server_prompt_description`   | `ops`   | `safe_write` | Description lint applied |
| `mcphub_reset_server_prompt_description`    | `ops`   | `safe_write` | Clears override          |
| `mcphub_toggle_server_resource`             | `ops`   | `safe_write` | Resource enable/disable  |
| `mcphub_update_server_resource_description` | `ops`   | `safe_write` | Description lint applied |
| `mcphub_reset_server_resource_description`  | `ops`   | `safe_write` | Clears override          |

## Groups and Costs

| Tool                               | Profile | Risk          | Notes                    |
| ---------------------------------- | ------- | ------------- | ------------------------ |
| `mcphub_get_server_costs`          | `safe`  | `read`        | Per-server cost data     |
| `mcphub_get_group_costs`           | `safe`  | `read`        | Per-group cost data      |
| `mcphub_list_groups`               | `safe`  | `read`        | Group inventory          |
| `mcphub_get_group`                 | `safe`  | `read`        | One group                |
| `mcphub_create_group`              | `admin` | `destructive` | Group creation           |
| `mcphub_update_group`              | `admin` | `destructive` | Group mutation           |
| `mcphub_delete_group`              | `admin` | `destructive` | Confirmation required    |
| `mcphub_batch_create_groups`       | `admin` | `destructive` | Batch create             |
| `mcphub_list_group_servers`        | `safe`  | `read`        | Group membership         |
| `mcphub_add_server_to_group`       | `ops`   | `safe_write`  | Membership add           |
| `mcphub_remove_server_from_group`  | `ops`   | `safe_write`  | Membership remove        |
| `mcphub_replace_group_servers`     | `ops`   | `safe_write`  | Full membership replace  |
| `mcphub_get_group_server_configs`  | `safe`  | `read`        | Group-specific overrides |
| `mcphub_get_group_server_config`   | `safe`  | `read`        | One override             |
| `mcphub_update_group_server_tools` | `ops`   | `safe_write`  | Replace selected tools   |

## Settings, Templates, and System Config

| Tool                            | Profile | Risk               | Notes                                      |
| ------------------------------- | ------- | ------------------ | ------------------------------------------ |
| `mcphub_get_settings_snapshot`  | `safe`  | `secret_sensitive` | Redacted snapshot                          |
| `mcphub_export_settings`        | `safe`  | `secret_sensitive` | Redacted export                            |
| `mcphub_export_config_template` | `ops`   | `safe_write`       | Template export                            |
| `mcphub_export_group_template`  | `ops`   | `safe_write`       | Group export                               |
| `mcphub_import_config_template` | `all`   | `dangerous_config` | Confirmation required                      |
| `mcphub_update_system_config`   | `all`   | `dangerous_config` | Confirmation + `ALLOW_SYSTEM_CONFIG_WRITE` |

## Built-in Prompts and Resources

| Tool                             | Profile | Risk          | Notes                    |
| -------------------------------- | ------- | ------------- | ------------------------ |
| `mcphub_list_builtin_prompts`    | `safe`  | `read`        | Prompt inventory         |
| `mcphub_get_builtin_prompt`      | `safe`  | `read`        | One prompt               |
| `mcphub_create_builtin_prompt`   | `admin` | `destructive` | Prompt creation          |
| `mcphub_update_builtin_prompt`   | `ops`   | `safe_write`  | Description lint applied |
| `mcphub_delete_builtin_prompt`   | `admin` | `destructive` | Confirmation required    |
| `mcphub_list_builtin_resources`  | `safe`  | `read`        | Resource inventory       |
| `mcphub_get_builtin_resource`    | `safe`  | `read`        | One resource             |
| `mcphub_read_builtin_resource`   | `safe`  | `read`        | Fetch resource contents  |
| `mcphub_create_builtin_resource` | `admin` | `destructive` | Resource creation        |
| `mcphub_update_builtin_resource` | `ops`   | `safe_write`  | Description lint applied |
| `mcphub_delete_builtin_resource` | `admin` | `destructive` | Confirmation required    |

## Market, Cloud, Registry, and OpenAPI

| Tool                                       | Profile | Risk               | Notes                                     |
| ------------------------------------------ | ------- | ------------------ | ----------------------------------------- |
| `mcphub_list_market_servers`               | `safe`  | `read`             | Public market list                        |
| `mcphub_search_market_servers`             | `safe`  | `read`             | Public market search                      |
| `mcphub_get_market_server`                 | `safe`  | `read`             | One market entry                          |
| `mcphub_list_market_categories`            | `safe`  | `read`             | Market categories                         |
| `mcphub_get_market_servers_by_category`    | `safe`  | `read`             | Market by category                        |
| `mcphub_list_market_tags`                  | `safe`  | `read`             | Market tags                               |
| `mcphub_get_market_servers_by_tag`         | `safe`  | `read`             | Market by tag                             |
| `mcphub_list_cloud_servers`                | `safe`  | `read`             | Cloud list                                |
| `mcphub_search_cloud_servers`              | `safe`  | `read`             | Cloud search                              |
| `mcphub_get_cloud_server`                  | `safe`  | `read`             | One cloud entry                           |
| `mcphub_get_cloud_server_tools`            | `safe`  | `read`             | Cloud tool inventory                      |
| `mcphub_list_cloud_categories`             | `safe`  | `read`             | Cloud categories                          |
| `mcphub_get_cloud_servers_by_category`     | `safe`  | `read`             | Cloud by category                         |
| `mcphub_list_cloud_tags`                   | `safe`  | `read`             | Cloud tags                                |
| `mcphub_get_cloud_servers_by_tag`          | `safe`  | `read`             | Cloud by tag                              |
| `mcphub_call_cloud_tool`                   | `all`   | `dangerous_config` | Executes marketplace-hosted tool call     |
| `mcphub_list_registry_servers`             | `safe`  | `read`             | Official registry proxy                   |
| `mcphub_get_registry_server_versions`      | `safe`  | `read`             | Registry version index                    |
| `mcphub_get_registry_server_version`       | `safe`  | `read`             | One registry version payload              |
| `mcphub_get_downstream_openapi_spec`       | `safe`  | `read`             | Downstream tools spec, not management API |
| `mcphub_get_group_downstream_openapi_spec` | `safe`  | `read`             | Group downstream tools spec               |
| `mcphub_list_openapi_servers`              | `safe`  | `read`             | OpenAPI server metadata                   |
| `mcphub_get_openapi_stats`                 | `safe`  | `read`             | OpenAPI stats                             |

## Changelog and MCPB

| Tool                               | Profile | Risk               | Notes                        |
| ---------------------------------- | ------- | ------------------ | ---------------------------- |
| `mcphub_get_changelog_update_info` | `safe`  | `read`             | Upstream release metadata    |
| `mcphub_upload_mcpb_bundle`        | `all`   | `dangerous_config` | Requires `ALLOW_MCPB_UPLOAD` |

## Notes

- Exact schemas are enforced in code and exposed to MCP clients during `tools/list`.
- Destructive tools use confirmation fields.
- Tools omitted from this document are intentionally unsupported or internal-only and are tracked in [api-coverage.md](./api-coverage.md).
- Remaining deliberate gaps are narrow:
  - `internal` upstream routes stay out of scope permanently;
  - `unsupported` downstream passthrough routes stay excluded because this project is a management layer, not a raw MCP proxy;
  - `streaming-only` routes such as log streaming remain future candidates for MCP resource/subscription modeling rather than request-response tools.
