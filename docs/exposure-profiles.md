# Exposure Profiles

## Summary

Profiles are cumulative:

```text
safe -> ops -> admin -> all
```

Each transport chooses one profile per MCP endpoint or stdio process.

## Profile Table

| Profile | Typical audience                             | Allowed change level | Examples                                                                             |
| ------- | -------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------ |
| `safe`  | read-only agents, observability, diagnostics | none                 | health, servers, groups, costs, logs, marketplace, registry                          |
| `ops`   | SRE and automation workflows                 | reversible           | reload server, toggle server/tool/prompt/resource, group membership, template export |
| `admin` | trusted operators                            | destructive admin    | create/update/delete servers, groups, users, bearer keys, OAuth clients              |
| `all`   | owner-controlled maintenance                 | maximum              | cloud tool call, MCPB upload, template import, system config writes                  |

## Additional Gates

Some tools require both the right profile and an enabled feature flag:

| Flag                        | Affected tools                                             |
| --------------------------- | ---------------------------------------------------------- |
| `ALLOW_AUTH_ADMIN_TOOLS`    | bearer key and OAuth client management, user CRUD          |
| `ALLOW_STDIO_SERVER_CREATE` | creation or update of stdio-backed upstream MCPHub servers |
| `ALLOW_MCPB_UPLOAD`         | `mcphub_upload_mcpb_bundle`                                |
| `ALLOW_SYSTEM_CONFIG_WRITE` | `mcphub_update_system_config`                              |

## Safe Profile

Safe tools cover:

- health and public runtime config;
- settings snapshot and redacted settings export;
- server, group, cost, activity, log, discovery, market, cloud, and registry reads;
- built-in prompt and resource reads;
- downstream OpenAPI introspection reads.

## Ops Profile Additions

Ops adds:

- server reload and toggle;
- server tool/prompt/resource toggles;
- server tool/prompt/resource description updates and resets;
- group membership operations;
- group tool-selection override updates;
- template export endpoints.

## Admin Profile Additions

Admin adds:

- server create, update, delete, and batch create;
- group create, update, delete, and batch create;
- user management;
- bearer key management;
- OAuth client management;
- log cleanup and activity cleanup;
- built-in prompt and resource creation/deletion.

## All Profile Additions

All adds:

- cloud marketplace tool execution;
- template import;
- MCPB bundle upload;
- OAuth client secret regeneration;
- system config writes.

## Recommended Mapping

- Use `safe` for general local assistants and dashboards.
- Use `ops` for controlled maintenance flows.
- Use `admin` for private operator-only channels.
- Use `all` only for owner-controlled automation, CI, or emergency maintenance.
