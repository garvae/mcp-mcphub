// SPDX-License-Identifier: Apache-2.0

export function assertAllowedCommand(command: string, allowStdioServerCreate: boolean): void {
  if (!allowStdioServerCreate) {
    throw new Error(`Stdio server creation is disabled for command "${command}".`);
  }
}

export function assertAllowedTargetHost(
  candidateUrl: string,
  allowedTargetHosts: readonly string[],
): void {
  if (allowedTargetHosts.length === 0) {
    return;
  }

  const hostname = new URL(candidateUrl).hostname.toLowerCase();
  const allowed = allowedTargetHosts.some((candidate) => candidate.toLowerCase() === hostname);

  if (!allowed) {
    throw new Error(`Target host "${hostname}" is not present in MCP_ALLOWED_TARGET_HOSTS.`);
  }
}

function isUrlBearingKey(key: string): boolean {
  const normalizedKey = key.toLowerCase();
  return (
    normalizedKey.includes('url') ||
    normalizedKey.includes('endpoint') ||
    normalizedKey.includes('origin')
  );
}

function collectCandidateUrls(value: unknown, path: string[], candidates: string[]): void {
  if (typeof value === 'string') {
    if (path.some(isUrlBearingKey)) {
      candidates.push(value);
    }

    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectCandidateUrls(entry, path, candidates);
    }

    return;
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      collectCandidateUrls(entry, [...path, key], candidates);
    }
  }
}

export function extractCandidateUrls(payload: Record<string, unknown>): string[] {
  const candidates: string[] = [];
  collectCandidateUrls(payload, [], candidates);
  return candidates;
}
