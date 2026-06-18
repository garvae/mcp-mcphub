// SPDX-License-Identifier: Apache-2.0

export type CliCommand = 'doctor' | 'help' | 'http' | 'stdio' | 'version';

export type CliIo = {
  stderr: NodeJS.WriteStream;
  stdout: NodeJS.WriteStream;
};

export type CliContext = {
  args: readonly string[];
  io: CliIo;
};

export type CliResult = {
  exitCode: number;
};

export type CliHandlerResult = CliResult | Promise<CliResult>;
