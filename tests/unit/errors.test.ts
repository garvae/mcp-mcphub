import { describe, expect, it } from 'vitest';

import {
  McpHubApiError,
  createAuthRefreshError,
  createInvalidResponseError,
  createNetworkError,
  createResponseError,
  createTimeoutError,
} from '../../src/core/mcphub-client/errors.js';

describe('mcphub client errors', () => {
  it.each([
    { code: 'unauthorized', status: 401 },
    { code: 'forbidden', status: 403 },
    { code: 'not_found', status: 404 },
    { code: 'conflict', status: 409 },
    { code: 'rate_limited', status: 429 },
    { code: 'server_error', status: 500 },
    { code: 'unexpected_status', status: 418 },
  ])('maps status $status to $code', ({ code, status }) => {
    const error = createResponseError(status, { message: `status-${String(status)}` }, 'req-1');

    expect(error).toBeInstanceOf(McpHubApiError);
    expect(error.code).toBe(code);
    expect(error.message).toBe(`status-${String(status)}`);
    expect(error.requestId).toBe('req-1');
    expect(error.status).toBe(status);
  });

  it('falls back to a generic response message when payload message is missing', () => {
    const error = createResponseError(422, { error: 'unprocessable' });

    expect(error.code).toBe('unexpected_status');
    expect(error.message).toBe('MCPHub API request failed with status 422.');
  });

  it('creates timeout, network, invalid-json, and auth-refresh errors', () => {
    const timeoutError = createTimeoutError(2500);
    const networkCause = new Error('socket hang up');
    const networkError = createNetworkError(networkCause);
    const invalidJsonError = createInvalidResponseError('<html>broken</html>');
    const authRefreshError = createAuthRefreshError({ detail: 'invalid credentials' });

    expect(timeoutError.code).toBe('request_timeout');
    expect(timeoutError.message).toContain('2500ms');
    expect(networkError.code).toBe('network_error');
    expect(networkError.details).toBe(networkCause);
    expect(invalidJsonError.code).toBe('invalid_response');
    expect(invalidJsonError.details).toBe('<html>broken</html>');
    expect(authRefreshError.code).toBe('auth_refresh_failed');
    expect(authRefreshError.details).toEqual({ detail: 'invalid credentials' });
  });
});
