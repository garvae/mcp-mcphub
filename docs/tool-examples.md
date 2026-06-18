# Tool Examples

These examples show representative tool calls by exposure profile.

The exact schemas exposed to MCP clients come from the runtime tool registry and generated catalogs.

## `safe`

### Health check

Tool:

```text
mcphub_health_check
```

Input:

```json
{}
```

### Get one server

Tool:

```text
mcphub_get_server
```

Input:

```json
{
  "name": "production-gateway"
}
```

## `ops`

### Reload a server

Tool:

```text
mcphub_reload_server
```

Input:

```json
{
  "name": "production-gateway"
}
```

### Update a per-server tool description

Tool:

```text
mcphub_update_server_tool_description
```

Input:

```json
{
  "serverName": "production-gateway",
  "toolName": "status",
  "description": "Short production status summary for operators."
}
```

## `admin`

### Delete a server

Tool:

```text
mcphub_delete_server
```

Input:

```json
{
  "confirm": true,
  "expectedName": "staging-gateway",
  "name": "staging-gateway",
  "reason": "Retire old staging server after migration."
}
```

### Create a group

Tool:

```text
mcphub_create_group
```

Input:

```json
{
  "name": "incident-response",
  "description": "Temporary group for incident workflows."
}
```

## `all`

### Import a config template

Tool:

```text
mcphub_import_config_template
```

Input:

```json
{
  "confirm": true,
  "reason": "Restore approved template during planned maintenance.",
  "template": {}
}
```

### Update system config

Tool:

```text
mcphub_update_system_config
```

Input:

```json
{
  "confirm": true,
  "reason": "Apply reviewed auth policy update.",
  "routing": {
    "skipAuth": false
  }
}
```

## Notes

- Prefer `safe` first and escalate only when the task really needs a broader profile.
- Keep `reason` fields specific enough for auditability.
- For high-risk operations, check [security.md](./security.md) and [generated/README.md](./generated/README.md) before invoking the tool.
