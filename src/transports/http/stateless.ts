// SPDX-License-Identifier: Apache-2.0

import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  JSONRPCMessageSchema,
  isJSONRPCErrorResponse,
  isJSONRPCNotification,
  isJSONRPCRequest,
  isJSONRPCResultResponse,
  type JSONRPCMessage,
  type RequestId,
} from '@modelcontextprotocol/sdk/types.js';

import type { AppConfig } from '../../config/env.js';
import { createConfiguredMcpHubClient } from '../../core/mcphub-client/factory.js';
import { createManagedMcpServer } from '../../mcp/server.js';
import type { AuditEvent } from '../../observability/audit.js';
import type { Logger } from '../../observability/logger.js';
import type { ExposureProfile } from '../../core/coverage/types.js';
import { PACKAGE_VERSION } from '../../version.js';

const MODERN_PROTOCOL_VERSION = '2026-07-28';
const MODERN_CACHE_TTL_MS = 60_000;
const METHOD_NOT_FOUND_CODE = -32601;
const HEADER_MISMATCH_CODE = -32001;
const UNSUPPORTED_PROTOCOL_VERSION_CODE = -32004;
const CACHEABLE_METHODS = new Set([
  'prompts/list',
  'resources/list',
  'resources/read',
  'resources/templates/list',
  'server/discover',
  'tools/list',
]);

type HandleStatelessRequestOptions = {
  actor: string;
  auditLogger: {
    record: (event: AuditEvent) => void;
  };
  config: AppConfig;
  forceReadonly: boolean;
  logger: Logger;
  parsedBody: unknown;
  redactor: {
    redactString: (value: string) => string;
    redactValue: <T>(value: T) => T;
  };
  request: IncomingMessage;
  requestedProfile: ExposureProfile;
  response: ServerResponse;
  upstreamProfileName?: string | undefined;
};

type ModernMcpRequest = {
  id?: RequestId | undefined;
  method: string;
  params?: Record<string, unknown> | undefined;
};

type ModernMcpMeta = {
  clientCapabilities: Record<string, unknown>;
  clientInfo: {
    name: string;
    version: string;
  };
  protocolVersion: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify(payload));
}

function createErrorBody(
  requestId: RequestId | undefined,
  code: number,
  message: string,
  data?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    ...(requestId !== undefined ? { id: requestId } : {}),
    error: {
      code,
      ...(data === undefined ? {} : { data }),
      message,
    },
  };
}

function readHeader(request: IncomingMessage, headerName: string): string | undefined {
  const value = request.headers[headerName.toLowerCase()];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function extractModernRequest(body: unknown): ModernMcpRequest | undefined {
  if (!isRecord(body)) {
    return undefined;
  }

  const parsed = JSONRPCMessageSchema.safeParse(body);
  if (!parsed.success) {
    return undefined;
  }

  if (!isJSONRPCRequest(parsed.data) && !isJSONRPCNotification(parsed.data)) {
    return undefined;
  }

  return {
    ...(isJSONRPCRequest(parsed.data) ? { id: parsed.data.id } : {}),
    method: parsed.data.method,
    params: isRecord(parsed.data.params) ? parsed.data.params : undefined,
  };
}

function extractModernMeta(request: ModernMcpRequest): ModernMcpMeta | undefined {
  const meta = request.params?._meta;
  if (!isRecord(meta)) {
    return undefined;
  }

  const protocolVersion = meta['io.modelcontextprotocol/protocolVersion'];
  const clientInfo = meta['io.modelcontextprotocol/clientInfo'];
  const clientCapabilities = meta['io.modelcontextprotocol/clientCapabilities'];

  if (
    typeof protocolVersion !== 'string' ||
    !isRecord(clientInfo) ||
    typeof clientInfo.name !== 'string' ||
    typeof clientInfo.version !== 'string' ||
    !isRecord(clientCapabilities)
  ) {
    return undefined;
  }

  return {
    clientCapabilities,
    clientInfo: {
      name: clientInfo.name,
      version: clientInfo.version,
    },
    protocolVersion,
  };
}

function expectedNameForMethod(request: ModernMcpRequest): string | undefined {
  if (request.method === 'tools/call') {
    return typeof request.params?.name === 'string' ? request.params.name : undefined;
  }

  if (request.method === 'resources/read') {
    return typeof request.params?.uri === 'string' ? request.params.uri : undefined;
  }

  if (request.method === 'prompts/get') {
    return typeof request.params?.name === 'string' ? request.params.name : undefined;
  }

  return undefined;
}

function createDiscoverResult(requestedProfile: ExposureProfile): Record<string, unknown> {
  return {
    cacheScope: 'private',
    capabilities: {
      prompts: {},
      resources: {},
      tools: {},
    },
    resultType: 'complete',
    serverInfo: {
      name: `mcp-mcphub-${requestedProfile}`,
      version: PACKAGE_VERSION,
    },
    supportedVersions: [MODERN_PROTOCOL_VERSION],
    ttlMs: MODERN_CACHE_TTL_MS,
  };
}

function applyCacheHints(method: string, payload: JSONRPCMessage): JSONRPCMessage {
  if (!CACHEABLE_METHODS.has(method) || !isJSONRPCResultResponse(payload)) {
    return payload;
  }

  return {
    ...payload,
    result: {
      ...payload.result,
      cacheScope: 'private',
      ttlMs: MODERN_CACHE_TTL_MS,
    },
  };
}

class DirectResponseTransport {
  onclose?: (() => void) | undefined;
  onerror?: ((error: Error) => void) | undefined;
  onmessage?: ((message: JSONRPCMessage) => void) | undefined;
  sessionId?: string | undefined;

  private pending:
    | {
        messages: JSONRPCMessage[];
        reject: (error: Error) => void;
        requestId: RequestId;
        resolve: (messages: JSONRPCMessage[]) => void;
        timeout: NodeJS.Timeout;
      }
    | undefined;

  start(): Promise<void> {
    return Promise.resolve();
  }

  close(): Promise<void> {
    if (this.pending !== undefined) {
      clearTimeout(this.pending.timeout);
      this.pending.reject(new Error('Transport closed before a response was emitted.'));
      this.pending = undefined;
    }

    this.onclose?.();
    return Promise.resolve();
  }

  send(message: JSONRPCMessage): Promise<void> {
    if (this.pending === undefined) {
      return Promise.resolve();
    }

    this.pending.messages.push(message);
    if (
      (isJSONRPCResultResponse(message) || isJSONRPCErrorResponse(message)) &&
      message.id === this.pending.requestId
    ) {
      clearTimeout(this.pending.timeout);
      const { messages, resolve } = this.pending;
      this.pending = undefined;
      resolve(messages);
    }

    return Promise.resolve();
  }

  async dispatchRequest(message: JSONRPCMessage): Promise<JSONRPCMessage[]> {
    if (!isJSONRPCRequest(message)) {
      throw new Error('dispatchRequest expects a JSON-RPC request.');
    }

    if (this.onmessage === undefined) {
      throw new Error('Transport is not connected.');
    }

    return new Promise<JSONRPCMessage[]>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pending === undefined) {
          return;
        }

        this.pending = undefined;
        reject(new Error(`Timed out waiting for a response to "${message.method}".`));
      }, 10_000);

      this.pending = {
        messages: [],
        reject,
        requestId: message.id,
        resolve,
        timeout,
      };

      try {
        this.onmessage?.(message);
      } catch (error) {
        clearTimeout(timeout);
        this.pending = undefined;
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  dispatchNotification(message: JSONRPCMessage): Promise<void> {
    if (!isJSONRPCNotification(message)) {
      throw new Error('dispatchNotification expects a JSON-RPC notification.');
    }

    this.onmessage?.(message);
    return Promise.resolve();
  }
}

export async function handleStatelessHttpRequest(options: HandleStatelessRequestOptions): Promise<void> {
  if (options.request.method !== 'POST') {
    options.response.setHeader('allow', 'POST');
    writeJson(options.response, 405, { error: 'Method not allowed.' });
    return;
  }

  const parsedRequest = extractModernRequest(options.parsedBody);
  if (parsedRequest === undefined) {
    writeJson(options.response, 400, createErrorBody(undefined, -32600, 'Invalid JSON-RPC request.'));
    return;
  }

  const modernMeta = extractModernMeta(parsedRequest);
  const protocolHeader = readHeader(options.request, 'mcp-protocol-version');
  const methodHeader = readHeader(options.request, 'mcp-method');
  const expectedName = expectedNameForMethod(parsedRequest);
  const nameHeader = readHeader(options.request, 'mcp-name');

  if (modernMeta === undefined) {
    writeJson(
      options.response,
      400,
      createErrorBody(parsedRequest.id, HEADER_MISMATCH_CODE, 'Header mismatch: request metadata is missing or malformed.'),
    );
    return;
  }

  if (protocolHeader === undefined || protocolHeader !== modernMeta.protocolVersion) {
    writeJson(
      options.response,
      400,
      createErrorBody(
        parsedRequest.id,
        HEADER_MISMATCH_CODE,
        `Header mismatch: MCP-Protocol-Version header value "${protocolHeader ?? '<missing>'}" does not match body value "${modernMeta.protocolVersion}".`,
      ),
    );
    return;
  }

  if (modernMeta.protocolVersion !== MODERN_PROTOCOL_VERSION) {
    writeJson(
      options.response,
      400,
      createErrorBody(parsedRequest.id, UNSUPPORTED_PROTOCOL_VERSION_CODE, 'Unsupported protocol version', {
        requested: modernMeta.protocolVersion,
        supported: [MODERN_PROTOCOL_VERSION],
      }),
    );
    return;
  }

  if (methodHeader === undefined || methodHeader !== parsedRequest.method) {
    writeJson(
      options.response,
      400,
      createErrorBody(
        parsedRequest.id,
        HEADER_MISMATCH_CODE,
        `Header mismatch: Mcp-Method header value "${methodHeader ?? '<missing>'}" does not match body value "${parsedRequest.method}".`,
      ),
    );
    return;
  }

  if (expectedName !== undefined && (nameHeader === undefined || nameHeader !== expectedName)) {
    writeJson(
      options.response,
      400,
      createErrorBody(
        parsedRequest.id,
        HEADER_MISMATCH_CODE,
        `Header mismatch: Mcp-Name header value "${nameHeader ?? '<missing>'}" does not match body value "${expectedName}".`,
      ),
    );
    return;
  }

  if (parsedRequest.method === 'server/discover') {
    options.auditLogger.record({
      action: 'http.request',
      actor: options.actor,
      profile: options.requestedProfile,
      target: `${options.request.method} ${options.request.url ?? '/mcp'}`,
      ...(options.upstreamProfileName !== undefined ? { upstreamProfile: options.upstreamProfileName } : {}),
    });
    writeJson(options.response, 200, {
      id: parsedRequest.id,
      jsonrpc: '2.0',
      result: createDiscoverResult(options.requestedProfile),
    });
    return;
  }

  const client = createConfiguredMcpHubClient(options.config, options.logger, options.upstreamProfileName);
  const mcpServer = createManagedMcpServer({
    client,
    enableResourceSubscriptions: false,
    enableResources: true,
    exposureProfile: options.requestedProfile,
    featureFlags: {
      allowAuthAdminTools: options.config.allowAuthAdminTools,
      allowMcpbUpload: options.config.allowMcpbUpload,
      allowStdioServerCreate: options.config.allowStdioServerCreate,
      allowSystemConfigWrite: options.config.allowSystemConfigWrite,
      allowedTargetHosts: options.config.security.allowedTargetHosts,
      forceReadonly: options.forceReadonly,
    },
    redactor: options.redactor,
  });
  const transport = new DirectResponseTransport();

  options.auditLogger.record({
    action: 'http.request',
    actor: options.actor,
    profile: options.requestedProfile,
    target: `${options.request.method} ${options.request.url ?? '/mcp'}`,
    ...(options.upstreamProfileName !== undefined ? { upstreamProfile: options.upstreamProfileName } : {}),
  });

  try {
    await mcpServer.connect(transport as never);

    const parsedMessage = JSONRPCMessageSchema.parse(options.parsedBody);

    if (isJSONRPCNotification(parsedMessage)) {
      await transport.dispatchNotification(parsedMessage);
      options.response.statusCode = 202;
      options.response.end();
      return;
    }

    const messages = await transport.dispatchRequest(parsedMessage);
    const finalMessage = messages[messages.length - 1];
    if (finalMessage === undefined) {
      writeJson(options.response, 500, createErrorBody(parsedRequest.id, -32603, 'No response message was emitted.'));
      return;
    }

    const payload = applyCacheHints(parsedRequest.method, finalMessage);
    const statusCode =
      isJSONRPCErrorResponse(payload) && payload.error.code === METHOD_NOT_FOUND_CODE
        ? 404
        : isJSONRPCErrorResponse(payload)
          ? 400
          : 200;

    writeJson(options.response, statusCode, payload);
  } finally {
    await transport.close();
    await mcpServer.close();
  }
}
