// SPDX-License-Identifier: Apache-2.0

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import type { AppConfig } from '../../config/env.js';
import { createConfiguredMcpHubClient } from '../../core/mcphub-client/factory.js';
import { createRedactor } from '../../core/redaction/redactor.js';
import type { ExposureProfile } from '../../core/coverage/types.js';
import { createManagedMcpServer } from '../../mcp/server.js';
import { createAuditLogger } from '../../observability/audit.js';
import { createLogger, type Logger } from '../../observability/logger.js';

export type StartStdioServerOptions = {
  config: AppConfig;
  exposureProfile: ExposureProfile;
  forceReadonly?: boolean | undefined;
  logger?: Logger;
  mcpHubProfileName?: string | undefined;
  stderr?: NodeJS.WriteStream | undefined;
};

function createPassthroughRedactor() {
  return {
    redactString(value: string): string {
      return value;
    },
    redactValue<T>(value: T): T {
      return value;
    },
  };
}

export async function startStdioServer(options: StartStdioServerOptions): Promise<void> {
  const logger = options.logger ?? createLogger(options.config.logLevel, options.stderr);
  const auditLogger = createAuditLogger(logger, options.config.audit);
  const client = createConfiguredMcpHubClient(options.config, logger, options.mcpHubProfileName);
  const redactor = options.config.redactSecrets ? createRedactor() : createPassthroughRedactor();
  const server = createManagedMcpServer({
    client,
    enableResources: true,
    exposureProfile: options.exposureProfile,
    featureFlags: {
      allowAuthAdminTools: options.config.allowAuthAdminTools,
      allowMcpbUpload: options.config.allowMcpbUpload,
      allowStdioServerCreate: options.config.allowStdioServerCreate,
      allowSystemConfigWrite: options.config.allowSystemConfigWrite,
      allowedTargetHosts: options.config.security.allowedTargetHosts,
      forceReadonly: options.forceReadonly ?? options.config.forceReadonly,
    },
    redactor,
  });
  const transport = new StdioServerTransport();

  await server.connect(transport);
  auditLogger.record({
    action: 'stdio.start',
    actor: 'local-process',
    profile: options.exposureProfile,
    upstreamProfile: options.mcpHubProfileName ?? options.config.mcpHub.defaultProfile,
  });
  logger.info('stdio transport started', {
    exposureProfile: options.exposureProfile,
    mcpHubProfile: options.mcpHubProfileName ?? options.config.mcpHub.defaultProfile,
  });
}
