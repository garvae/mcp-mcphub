// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { DEFAULT_RESOURCE_POLL_INTERVAL_MS } from '../config/defaults.js';
import type { ExposureProfile } from '../core/coverage/types.js';
import { PACKAGE_VERSION } from '../version.js';
import { createToolRegistry } from './registry.js';

type CreateManagedMcpServerOptions = Parameters<typeof createToolRegistry>[0] & {
  enableResources?: boolean | undefined;
  enableResourceSubscriptions?: boolean | undefined;
  exposureProfile: ExposureProfile;
  resourcePollIntervalMs?: number | undefined;
};

const LOGS_RESOURCE_URI = 'mcphub://logs/stream';
const SETTINGS_RESOURCE_URI = 'mcphub://settings/snapshot';

export function createManagedMcpServer(options: CreateManagedMcpServerOptions): McpServer {
  const registry = createToolRegistry(options);
  const resourceCapabilities =
    options.enableResources === false
      ? undefined
      : options.enableResourceSubscriptions === false
        ? {}
        : { subscribe: true };
  const server = new McpServer(
    {
      name: `mcp-mcphub-${options.exposureProfile}`,
      version: PACKAGE_VERSION,
    },
    {
      ...(resourceCapabilities === undefined
        ? {}
        : { capabilities: { resources: resourceCapabilities } }),
    },
  );

  for (const tool of registry.list(options.exposureProfile)) {
    server.registerTool(
      tool.name,
      {
        annotations: tool.annotations,
        description: tool.description,
        ...(tool.inputSchema !== undefined ? { inputSchema: tool.inputSchema } : {}),
        outputSchema: tool.outputSchema,
      },
      async (input) => registry.execute(options.exposureProfile, tool.name, input),
    );
  }

  if (options.enableResources !== false) {
    server.registerResource(
      'mcphub-settings-snapshot',
      SETTINGS_RESOURCE_URI,
      {
        description: 'Redacted MCPHub settings snapshot.',
        mimeType: 'application/json',
      },
      async () => {
        const data =
          options.redactor?.redactValue(await options.client.settings.getSnapshot()) ??
          (await options.client.settings.getSnapshot());
        return {
          contents: [
            {
              mimeType: 'application/json',
              text: JSON.stringify(data, null, 2),
              uri: SETTINGS_RESOURCE_URI,
            },
          ],
        };
      },
    );

    server.registerResource(
      'mcphub-logs-stream',
      LOGS_RESOURCE_URI,
      {
        description:
          'Latest redacted MCPHub log snapshot. Clients may subscribe and reread on updates.',
        mimeType: 'application/json',
      },
      async () => {
        const data =
          options.redactor?.redactValue(await options.client.logs.list()) ??
          (await options.client.logs.list());
        return {
          contents: [
            {
              mimeType: 'application/json',
              text: JSON.stringify(data, null, 2),
              uri: LOGS_RESOURCE_URI,
            },
          ],
        };
      },
    );

    server.registerPrompt(
      'mcphub-safe-reload',
      {
        argsSchema: {
          serverName: z.string().min(1).describe('Server name to reload.'),
        },
        description: 'Draft a conservative reload workflow for one MCPHub server.',
      },
      ({ serverName }) => ({
        messages: [
          {
            content: {
              text: [
                `Inspect server "${serverName}" before taking action.`,
                'Use mcphub_get_server first, summarize the current enabled state, then use mcphub_reload_server only if the operator intent still matches.',
                'After reload, verify the result with mcphub_get_server or mcphub_health_check.',
              ].join(' '),
              type: 'text',
            },
            role: 'user',
          },
        ],
      }),
    );

    if (options.enableResourceSubscriptions !== false) {
      let lastLogsPayload = '';
      const resourcePollIntervalMs =
        options.resourcePollIntervalMs ?? DEFAULT_RESOURCE_POLL_INTERVAL_MS;
      const interval = setInterval(() => {
        void (async () => {
          if (!server.isConnected()) {
            return;
          }

          const logs =
            options.redactor?.redactValue(await options.client.logs.list()) ??
            (await options.client.logs.list());
          const nextPayload = JSON.stringify(logs);
          if (nextPayload === lastLogsPayload) {
            return;
          }

          lastLogsPayload = nextPayload;
          await server.server.sendResourceUpdated({ uri: LOGS_RESOURCE_URI });
        })();
      }, resourcePollIntervalMs);
      interval.unref();

      const originalClose = server.close.bind(server);
      server.close = async () => {
        clearInterval(interval);
        await originalClose();
      };
    }
  }

  return server;
}
