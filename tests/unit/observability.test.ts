import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createAuditLogger } from '../../src/observability/audit.js';
import { createLogger } from '../../src/observability/logger.js';

class MemoryStream {
  private readonly chunks: string[] = [];

  write(chunk: string): boolean {
    this.chunks.push(chunk);
    return true;
  }

  toString(): string {
    return this.chunks.join('');
  }
}

describe('observability', () => {
  it('filters messages below the configured log level', () => {
    const stream = new MemoryStream();
    const logger = createLogger('warn', stream as unknown as NodeJS.WriteStream);

    logger.info('hidden');
    logger.warn('visible');

    expect(stream.toString()).toContain('"message":"visible"');
    expect(stream.toString()).not.toContain('"message":"hidden"');
  });

  it('inherits child logger context', () => {
    const stream = new MemoryStream();
    const logger = createLogger('debug', stream as unknown as NodeJS.WriteStream).child({ component: 'client' });

    logger.error('failed', { requestId: 'req-1' });

    expect(stream.toString()).toContain('"component":"client"');
    expect(stream.toString()).toContain('"requestId":"req-1"');
  });

  it('writes structured logs to stderr-like streams', () => {
    const stream = new MemoryStream();
    const logger = createLogger('debug', stream as unknown as NodeJS.WriteStream);

    logger.info('hello', { requestId: 'abc' });

    expect(stream.toString()).toContain('"message":"hello"');
    expect(stream.toString()).toContain('"requestId":"abc"');
  });

  it('records audit events through the shared logger', () => {
    const stream = new MemoryStream();
    const audit = createAuditLogger(createLogger('info', stream as unknown as NodeJS.WriteStream));

    audit.record({ action: 'server.delete', actor: 'tester' });

    expect(stream.toString()).toContain('"message":"audit_event"');
    expect(stream.toString()).toContain('"action":"server.delete"');
  });

  it('writes audit events to a rotating file sink', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'mcphub-audit-'));
    const filePath = path.join(directory, 'audit.ndjson');
    const audit = createAuditLogger(createLogger('error', new MemoryStream() as unknown as NodeJS.WriteStream), {
      filePath,
      maxBytes: 120,
      maxFiles: 2,
    });

    audit.record({ action: 'event-1', actor: 'tester' });
    audit.record({ action: 'event-2', actor: 'tester' });
    audit.record({ action: 'event-3', actor: 'tester' });

    const current = readFileSync(filePath, 'utf8');
    const rotated = readFileSync(`${filePath}.1`, 'utf8');

    expect(current).toContain('"action":"event-3"');
    expect(rotated).toContain('"action":"event-2"');
    if (existsSync(`${filePath}.2`)) {
      expect(readFileSync(`${filePath}.2`, 'utf8')).toContain('"action":"event-1"');
    }

    await rm(directory, { force: true, recursive: true });
  });
});
