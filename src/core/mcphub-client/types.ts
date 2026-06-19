// SPDX-License-Identifier: Apache-2.0

import type { Logger } from '../../observability/logger.js';

export type FetchLike = typeof fetch;
export type SerializableBody =
  | ArrayBuffer
  | Blob
  | FormData
  | URLSearchParams
  | Uint8Array
  | string;

export type McpHubRequestMethod = 'DELETE' | 'GET' | 'POST' | 'PUT';

export type RequestBody =
  | FormData
  | SerializableBody
  | readonly unknown[]
  | URLSearchParams
  | Record<string, unknown>
  | undefined;

export type RequestQueryValue = boolean | null | number | string | undefined;

export type RequestQuery = Record<string, RequestQueryValue>;

export type AuthHeadersProvider = {
  canRetryAuth: () => boolean;
  getHeaders: () => Promise<Record<string, string>>;
  invalidate: () => void;
};

export type RequestClientOptions = {
  authProvider: AuthHeadersProvider;
  baseUrl: string;
  fetchImpl?: FetchLike;
  logger?: Logger;
  retryAttempts: number;
  retryBackoffMs: number;
  timeoutMs: number;
};

export type RequestOptions = {
  body?: RequestBody | undefined;
  headers?: Record<string, string> | undefined;
  idempotent?: boolean | undefined;
  method: McpHubRequestMethod;
  path: string;
  query?: RequestQuery | undefined;
};

export type McpHubClientOptions = RequestClientOptions;
