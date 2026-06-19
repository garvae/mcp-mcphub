// SPDX-License-Identifier: Apache-2.0

import { loadCommandEnvWithMetadata } from '../config-loader.js';
import { createAuthHeadersProvider } from '../../core/mcphub-client/auth-headers.js';
import { loadConfig } from '../../config/env.js';
import { type McpHubProfile, resolveProfileByName } from '../../config/profiles.js';
import { createConfiguredMcpHubClient } from '../../core/mcphub-client/factory.js';
import { createResponseError } from '../../core/mcphub-client/errors.js';
import { createLogger } from '../../observability/logger.js';
import type { CliContext, CliResult } from '../types.js';

type DoctorCommandOptions = {
  configPath?: string | undefined;
  json: boolean;
  mcpHubProfileName?: string | undefined;
};

type DoctorCheck = {
  detail: string;
  name: 'config_loaded' | 'credential_accepted' | 'recommended_warnings' | 'upstream_reachable';
  status: 'ok' | 'warn';
};

type DoctorJsonReport = {
  checks: DoctorCheck[];
  configSource: {
    kind: 'auto-dotenv' | 'config-file' | 'process-env';
    path?: string | undefined;
  };
  profile: {
    name: string;
    tokenKind: McpHubProfile['tokenKind'];
    url: string;
  };
  upstream: {
    publicVersion?: string | undefined;
  };
};

function parseDoctorCommandOptions(args: readonly string[]): DoctorCommandOptions {
  const options: DoctorCommandOptions = {
    json: false,
  };

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) {
      continue;
    }

    if (arg === '--config') {
      options.configPath = args[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith('--config=')) {
      options.configPath = arg.slice('--config='.length);
      continue;
    }

    if (arg === '--profile') {
      options.mcpHubProfileName = args[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith('--profile=')) {
      options.mcpHubProfileName = arg.slice('--profile='.length);
      continue;
    }

    if (arg === '--json') {
      options.json = true;
    }
  }

  return options;
}

function collectConfigWarnings(config: ReturnType<typeof loadConfig>): string[] {
  const warnings: string[] = [];

  if (config.http.host === '0.0.0.0' || config.http.host === '::') {
    warnings.push(`HTTP host "${config.http.host}" is publicly bound.`);
  }

  if (config.exposedProfiles.includes('all')) {
    warnings.push('The all exposure profile is enabled.');
  }

  if (config.allowAuthAdminTools) {
    warnings.push('ALLOW_AUTH_ADMIN_TOOLS is enabled.');
  }

  if (config.allowMcpbUpload) {
    warnings.push('ALLOW_MCPB_UPLOAD is enabled.');
  }

  if (config.allowStdioServerCreate) {
    warnings.push('ALLOW_STDIO_SERVER_CREATE is enabled.');
  }

  if (config.allowSystemConfigWrite) {
    warnings.push('ALLOW_SYSTEM_CONFIG_WRITE is enabled.');
  }

  if (!config.redactSecrets) {
    warnings.push('MCP_REDACT_SECRETS is disabled.');
  }

  if (Object.keys(config.http.authTokens).length === 0) {
    warnings.push('No HTTP auth tokens are configured.');
  }

  return warnings;
}

function hasSystemAllAccessKey(payload: unknown): boolean {
  return (
    Array.isArray(payload) &&
    payload.some((item) => {
      if (item === null || typeof item !== 'object') {
        return false;
      }

      const candidate = item as { accessType?: unknown; kind?: unknown };
      return candidate.kind === 'system' && candidate.accessType === 'all';
    })
  );
}

type PublicRuntimeConfig = {
  data?: {
    version?: string;
  };
};

function compareVersions(left: string, right: string): number {
  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10));
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10));
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  return 0;
}

async function readPublicRuntimeVersion(baseUrl: string): Promise<string | undefined> {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/u, '')}/config`);
    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as PublicRuntimeConfig;
    return payload.data?.version;
  } catch {
    return undefined;
  }
}

async function probeManagementApiAccess(selectedProfile: McpHubProfile): Promise<void> {
  const authProvider = createAuthHeadersProvider({
    baseUrl: selectedProfile.url,
    ...(selectedProfile.betterAuthCookie !== undefined
      ? { betterAuthCookie: selectedProfile.betterAuthCookie }
      : {}),
    headerName: selectedProfile.authHeader,
    ...(selectedProfile.oauthClientId !== undefined
      ? { oauthClientId: selectedProfile.oauthClientId }
      : {}),
    ...(selectedProfile.oauthClientSecret !== undefined
      ? { oauthClientSecret: selectedProfile.oauthClientSecret }
      : {}),
    ...(selectedProfile.oauthScope !== undefined ? { oauthScope: selectedProfile.oauthScope } : {}),
    ...(selectedProfile.oauthTokenUrl !== undefined
      ? { oauthTokenUrl: selectedProfile.oauthTokenUrl }
      : {}),
    ...(selectedProfile.password !== undefined ? { password: selectedProfile.password } : {}),
    ...(selectedProfile.token !== undefined ? { token: selectedProfile.token } : {}),
    ...(selectedProfile.username !== undefined ? { username: selectedProfile.username } : {}),
    tokenKind: selectedProfile.tokenKind,
  });

  const doRequest = async () => {
    const response = await fetch(`${selectedProfile.url.replace(/\/$/u, '')}/api/servers`, {
      headers: await authProvider.getHeaders(),
    });

    if (response.ok) {
      return;
    }

    const payload = await response.json().catch(() => undefined);
    throw createResponseError(response.status, payload);
  };

  try {
    await doRequest();
  } catch (error) {
    if (error instanceof Error && authProvider.canRetryAuth()) {
      authProvider.invalidate();
      await doRequest();
      return;
    }

    throw error;
  }
}

export async function runDoctorCommand(context: CliContext): Promise<CliResult> {
  let upstreamVersion: string | undefined;
  let selectedProfileTokenKind: string | undefined;

  try {
    const options = parseDoctorCommandOptions(context.args);
    const loadedEnv = loadCommandEnvWithMetadata(options.configPath, process.env);
    const config = loadConfig(loadedEnv.env);
    const selectedProfileName = options.mcpHubProfileName ?? config.mcpHub.defaultProfile;
    const selectedProfile = resolveProfileByName(config.mcpHub, options.mcpHubProfileName);
    upstreamVersion = await readPublicRuntimeVersion(selectedProfile.url);
    selectedProfileTokenKind = selectedProfile.tokenKind;
    const logger = createLogger(config.logLevel, context.io.stderr);
    const client = createConfiguredMcpHubClient(config, logger, options.mcpHubProfileName);
    const warnings = collectConfigWarnings(config);
    const checks: DoctorCheck[] = [];

    checks.push({
      detail:
        loadedEnv.source === 'process-env'
          ? 'Configuration loaded from the current process environment.'
          : `Configuration loaded from ${loadedEnv.sourcePath ?? 'the selected config path'}.`,
      name: 'config_loaded',
      status: 'ok',
    });

    checks.push({
      detail:
        upstreamVersion === undefined
          ? `Could not read public runtime config from ${selectedProfile.url}/config, but the management probe may still succeed.`
          : `Reached ${selectedProfile.url} and detected MCPHub ${upstreamVersion}.`,
      name: 'upstream_reachable',
      status: upstreamVersion === undefined ? 'warn' : 'ok',
    });

    await probeManagementApiAccess(selectedProfile);
    checks.push({
      detail: `Authenticated management probe succeeded against ${selectedProfile.url}/api/servers using ${selectedProfile.tokenKind} auth.`,
      name: 'credential_accepted',
      status: 'ok',
    });

    if (selectedProfile.tokenKind !== 'bearer') {
      const bearerKeys = await client.bearerKeys.list();
      if (!hasSystemAllAccessKey(bearerKeys)) {
        warnings.push(
          'No system-level all-access bearer key is visible to the configured MCPHub profile.',
        );
      }
    }

    checks.push({
      detail:
        warnings.length === 0
          ? 'No unsafe runtime configuration was detected.'
          : `${String(warnings.length)} warning(s) detected.`,
      name: 'recommended_warnings',
      status: warnings.length === 0 ? 'ok' : 'warn',
    });

    if (options.json) {
      const report: DoctorJsonReport = {
        checks,
        configSource: {
          kind: loadedEnv.source,
          ...(loadedEnv.sourcePath !== undefined ? { path: loadedEnv.sourcePath } : {}),
        },
        profile: {
          name: selectedProfileName,
          tokenKind: selectedProfile.tokenKind,
          url: selectedProfile.url,
        },
        upstream: {
          ...(upstreamVersion !== undefined ? { publicVersion: upstreamVersion } : {}),
        },
      };

      context.io.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return { exitCode: 0 };
    }

    for (const check of checks) {
      const label = check.status === 'ok' ? 'OK' : 'WARN';
      context.io.stderr.write(`${label}: [${check.name}] ${check.detail}\n`);
    }

    for (const warning of warnings) {
      context.io.stderr.write(`WARN: ${warning}\n`);
    }

    return { exitCode: 0 };
  } catch (error) {
    let message = error instanceof Error ? error.message : String(error);

    if (
      selectedProfileTokenKind === 'bearer' &&
      upstreamVersion !== undefined &&
      compareVersions(upstreamVersion, '1.0.15') < 0 &&
      /Authentication required|No token, authorization denied/u.test(message)
    ) {
      message = `${message}\nDetected upstream MCPHub ${upstreamVersion}. Bearer-key management auth is best-effort below 1.0.15 and may not work on this upstream. Upgrade MCPHub or use JWT upstream auth.`;
    }

    context.io.stderr.write(`Doctor failed: ${message}\n`);
    return { exitCode: 1 };
  }
}
