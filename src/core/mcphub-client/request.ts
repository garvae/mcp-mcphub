// SPDX-License-Identifier: Apache-2.0

import {
  createInvalidResponseError,
  createNetworkError,
  createResponseError,
  createTimeoutError,
  McpHubApiError,
} from './errors.js';
import type { RequestBody, RequestClientOptions, RequestOptions } from './types.js';

type SerializedRequestBody = ArrayBuffer | Blob | FormData | URLSearchParams | Uint8Array | string | undefined;

function normalizeBaseUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function serializeBody(body: RequestBody): { body: SerializedRequestBody; contentType?: string } {
  if (body === undefined) {
    return { body: undefined };
  }

  if (
    typeof body === 'string' ||
    body instanceof ArrayBuffer ||
    body instanceof Blob ||
    body instanceof FormData ||
    body instanceof URLSearchParams
  ) {
    return { body };
  }

  return {
    body: JSON.stringify(body),
    contentType: 'application/json',
  };
}

function buildUrl(baseUrl: string, path: string, query?: RequestOptions['query']): URL {
  const url = new URL(`${normalizeBaseUrl(baseUrl)}${path}`);

  if (query !== undefined) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url;
}

function canRetryRequest(options: RequestOptions): boolean {
  if (options.idempotent !== undefined) {
    return options.idempotent;
  }

  return options.method === 'GET' || options.method === 'PUT' || options.method === 'DELETE';
}

async function sleep(delayMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const responseText = await response.text();
  if (responseText.length === 0) {
    return undefined as T;
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw createInvalidResponseError(responseText);
  }
}

export function createRequestClient(options: RequestClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const logger = options.logger;

  /**
   * Shared request executor for MCPHub API calls.
   * It centralizes timeout control, auth retry, and idempotent retries so later tool handlers
   * can depend on one transport behavior instead of duplicating edge-case logic.
   */
  async function execute<T>(requestOptions: RequestOptions): Promise<T> {
    const retryable = canRetryRequest(requestOptions);
    /**
     * Recursive retries keep the control flow explicit for auth refresh and transport backoff
     * without relying on an unbounded loop that static analysis treats as unconditional.
     */
    async function run(attempt: number, remainingRetries: number, authRetryAvailable: boolean): Promise<T> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

      try {
        const authHeaders = await options.authProvider.getHeaders();
        const serializedBody = serializeBody(requestOptions.body);
        const headers: Record<string, string> = {
          ...authHeaders,
          ...requestOptions.headers,
        };

        if (serializedBody.contentType !== undefined && headers['content-type'] === undefined) {
          headers['content-type'] = serializedBody.contentType;
        }

        const response = await fetchImpl(buildUrl(options.baseUrl, requestOptions.path, requestOptions.query), {
          ...(serializedBody.body !== undefined ? { body: serializedBody.body } : {}),
          headers,
          method: requestOptions.method,
          signal: controller.signal,
        });

        const requestId = response.headers.get('x-request-id') ?? undefined;
        if (response.ok) {
          return await parseJsonResponse<T>(response);
        }

        if (response.status === 401 && authRetryAvailable) {
          logger?.warn('Retrying MCPHub request after unauthorized response.', {
            attempt,
            path: requestOptions.path,
          });
          options.authProvider.invalidate();
          return await run(attempt, remainingRetries, false);
        }

        const errorPayload = await parseJsonResponse<unknown>(response).catch(() => undefined);
        const error = createResponseError(response.status, errorPayload, requestId);
        if (
          retryable &&
          remainingRetries > 0 &&
          (error.code === 'rate_limited' || error.code === 'server_error')
        ) {
          await sleep(options.retryBackoffMs * (attempt + 1));
          return await run(attempt + 1, remainingRetries - 1, authRetryAvailable);
        }

        throw error;
      } catch (error) {
        if (error instanceof McpHubApiError) {
          throw error;
        }

        const normalizedError =
          error instanceof DOMException && error.name === 'AbortError'
            ? createTimeoutError(options.timeoutMs)
            : createNetworkError(error);

        if (retryable && remainingRetries > 0) {
          logger?.warn('Retrying MCPHub request after transport failure.', {
            attempt,
            code: normalizedError.code,
            path: requestOptions.path,
          });
          await sleep(options.retryBackoffMs * (attempt + 1));
          return await run(attempt + 1, remainingRetries - 1, authRetryAvailable);
        }

        throw normalizedError;
      } finally {
        clearTimeout(timeout);
      }
    }

    return run(0, options.retryAttempts, options.authProvider.canRetryAuth());
  }

  return {
    json<T>(requestOptions: RequestOptions): Promise<T> {
      return execute<T>(requestOptions);
    },
  };
}
