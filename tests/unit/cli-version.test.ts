import { describe, expect, it } from 'vitest';

import { formatHelpOutput } from '../../src/cli/commands/help.js';
import { formatVersionOutput } from '../../src/cli/commands/version.js';
import { parseCliCommand } from '../../src/cli/parse.js';
import { PACKAGE_METADATA } from '../../src/version.js';

describe('parseCliCommand', () => {
  it('defaults to help when no command is provided', () => {
    expect(parseCliCommand([])).toBe('help');
  });

  it('maps version flags to the version command', () => {
    expect(parseCliCommand(['--version'])).toBe('version');
  });
});

describe('formatVersionOutput', () => {
  it('prints the package name and version', () => {
    expect(formatVersionOutput()).toBe(`${PACKAGE_METADATA.name} ${PACKAGE_METADATA.version}`);
  });
});

describe('formatHelpOutput', () => {
  it('documents the available scaffolded commands', () => {
    expect(formatHelpOutput()).toContain('mcp-mcphub stdio');
    expect(formatHelpOutput()).toContain('mcp-mcphub http');
  });
});
