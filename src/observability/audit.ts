// SPDX-License-Identifier: Apache-2.0

import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import path from 'node:path';

import type { Logger } from './logger.js';

export type AuditEvent = {
  action: string;
  actor?: string;
  profile?: string;
  risk?: string;
  target?: string;
  timestamp?: string;
  upstreamProfile?: string;
};

type AuditSinkOptions = {
  filePath?: string | undefined;
  maxBytes?: number | undefined;
  maxFiles?: number | undefined;
};

function rotateAuditFile(filePath: string, maxFiles: number): void {
  for (let index = maxFiles - 1; index >= 1; index -= 1) {
    const source = `${filePath}.${String(index)}`;
    const target = `${filePath}.${String(index + 1)}`;

    if (existsSync(source)) {
      renameSync(source, target);
    }
  }

  if (existsSync(filePath)) {
    renameSync(filePath, `${filePath}.1`);
  }
}

function writeAuditLine(
  filePath: string,
  payload: string,
  maxBytes: number,
  maxFiles: number,
): void {
  mkdirSync(path.dirname(filePath), { recursive: true });

  if (
    existsSync(filePath) &&
    statSync(filePath).size + Buffer.byteLength(payload, 'utf8') > maxBytes
  ) {
    rotateAuditFile(filePath, maxFiles);
  }

  appendFileSync(filePath, payload, 'utf8');
}

export function createAuditLogger(logger: Logger, options: AuditSinkOptions = {}) {
  const maxBytes = options.maxBytes ?? 1_048_576;
  const maxFiles = options.maxFiles ?? 5;

  return {
    record(event: AuditEvent): void {
      const payload = {
        ...event,
        timestamp: event.timestamp ?? new Date().toISOString(),
      };

      logger.info('audit_event', payload);

      if (options.filePath !== undefined) {
        writeAuditLine(options.filePath, `${JSON.stringify(payload)}\n`, maxBytes, maxFiles);
      }
    },
  };
}
