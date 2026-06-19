// SPDX-License-Identifier: Apache-2.0

export type McpHubApiErrorCode =
  | 'auth_refresh_failed'
  | 'conflict'
  | 'forbidden'
  | 'invalid_response'
  | 'network_error'
  | 'not_found'
  | 'rate_limited'
  | 'request_timeout'
  | 'server_error'
  | 'unauthorized'
  | 'unexpected_status';

export class McpHubApiError extends Error {
  readonly code: McpHubApiErrorCode;
  readonly details: unknown;
  readonly requestId: string | undefined;
  readonly status: number | undefined;

  constructor(
    message: string,
    options: {
      code: McpHubApiErrorCode;
      details?: unknown;
      requestId?: string | undefined;
      status?: number | undefined;
    },
  ) {
    super(message);
    this.code = options.code;
    this.details = options.details;
    this.name = 'McpHubApiError';
    this.requestId = options.requestId;
    this.status = options.status;
  }
}

function statusToCode(status: number): McpHubApiErrorCode {
  switch (status) {
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    case 429:
      return 'rate_limited';
    default:
      return status >= 500 ? 'server_error' : 'unexpected_status';
  }
}

export function createResponseError(
  status: number,
  payload: unknown,
  requestId?: string,
): McpHubApiError {
  const message =
    typeof payload === 'object' &&
    payload !== null &&
    'message' in payload &&
    typeof payload.message === 'string'
      ? payload.message
      : `MCPHub API request failed with status ${String(status)}.`;

  return new McpHubApiError(message, {
    code: statusToCode(status),
    details: payload,
    requestId,
    status,
  });
}

export function createTimeoutError(timeoutMs: number): McpHubApiError {
  return new McpHubApiError(`MCPHub API request timed out after ${String(timeoutMs)}ms.`, {
    code: 'request_timeout',
  });
}

export function createNetworkError(error: unknown): McpHubApiError {
  return new McpHubApiError('Network error while calling MCPHub API.', {
    code: 'network_error',
    details: error,
  });
}

export function createInvalidResponseError(payload: string): McpHubApiError {
  return new McpHubApiError('MCPHub API returned invalid JSON.', {
    code: 'invalid_response',
    details: payload,
  });
}

export function createAuthRefreshError(error: unknown): McpHubApiError {
  return new McpHubApiError('Failed to refresh JWT credentials for MCPHub API access.', {
    code: 'auth_refresh_failed',
    details: error,
  });
}
