// SPDX-License-Identifier: Apache-2.0

export type CoverageClassification =
  | 'safe'
  | 'ops'
  | 'admin'
  | 'all'
  | 'resource'
  | 'prompt'
  | 'internal'
  | 'streaming-only'
  | 'deprecated'
  | 'unsupported';

export type ExposureProfile = 'safe' | 'ops' | 'admin' | 'all';

export type RiskClass =
  | 'read'
  | 'safe_write'
  | 'destructive'
  | 'dangerous_config'
  | 'secret_sensitive';

export type McpSurfaceKind = 'none' | 'prompt' | 'resource' | 'tool';

export type SnapshotRoute = {
  authenticated: boolean;
  fullPath: string;
  handlerName: string;
  includeInCoverage: boolean;
  line: number;
  method: 'ALL' | 'DELETE' | 'GET' | 'POST' | 'PUT';
  middlewareNames: string[];
  path: string;
  rawPath: string;
  routerName: 'app' | 'authenticatedRouter' | 'router';
  sourceFile: string;
};

export type CoverageEntry = {
  authenticated: boolean;
  classification: CoverageClassification;
  handlerName: string;
  line: number;
  mcp: {
    kind: McpSurfaceKind;
    name: string | null;
  };
  method: SnapshotRoute['method'];
  notes: string;
  path: string;
  profile: ExposureProfile | null;
  risk: RiskClass | null;
  sourceFile: string;
  sinceMcphubVersion: string;
};

export function routeKey(
  route: Pick<SnapshotRoute, 'fullPath' | 'method'> | Pick<CoverageEntry, 'method' | 'path'>,
): string {
  const path = 'fullPath' in route ? route.fullPath : route.path;
  return `${route.method} ${path}`;
}
