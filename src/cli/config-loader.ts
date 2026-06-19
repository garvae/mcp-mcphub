// SPDX-License-Identifier: Apache-2.0

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function parseKeyValueEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    env[key] = rawValue.replace(/^['"]|['"]$/gu, '');
  }

  return env;
}

function readConfigFile(configPath: string): Record<string, string> {
  const resolvedPath = path.resolve(configPath);
  const content = readFileSync(resolvedPath, 'utf8');

  return path.extname(resolvedPath).toLowerCase() === '.json'
    ? (JSON.parse(content) as Record<string, string>)
    : parseKeyValueEnv(content);
}

export type CommandEnvLoadResult = {
  env: NodeJS.ProcessEnv;
  source: 'auto-dotenv' | 'config-file' | 'process-env';
  sourcePath?: string | undefined;
};

export function loadCommandEnvWithMetadata(
  configPath: string | undefined,
  env: NodeJS.ProcessEnv,
): CommandEnvLoadResult {
  const autoEnvPath = path.resolve('.env');
  const autoEnv =
    configPath === undefined && existsSync(autoEnvPath) ? readConfigFile(autoEnvPath) : undefined;
  const fileEnv = configPath === undefined ? autoEnv : readConfigFile(configPath);

  if (fileEnv === undefined) {
    return {
      env,
      source: 'process-env',
    };
  }

  // Empty-string process values are usually accidental shell leftovers and should not erase
  // non-empty file configuration loaded from .env or --config.
  const explicitEnvOverrides = Object.fromEntries(
    Object.entries(env).filter(([, value]) => value !== ''),
  );

  return {
    env: {
      ...fileEnv,
      ...explicitEnvOverrides,
    },
    source: configPath === undefined ? 'auto-dotenv' : 'config-file',
    sourcePath: configPath === undefined ? autoEnvPath : path.resolve(configPath),
  };
}

export function loadCommandEnv(
  configPath: string | undefined,
  env: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  return loadCommandEnvWithMetadata(configPath, env).env;
}
