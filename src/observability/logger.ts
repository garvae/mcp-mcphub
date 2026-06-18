// SPDX-License-Identifier: Apache-2.0

export type LogLevel = 'debug' | 'error' | 'info' | 'warn';

export type LogContext = Record<string, unknown>;

export type Logger = {
  child: (context: LogContext) => Logger;
  debug: (message: string, context?: LogContext) => void;
  error: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
};

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  error: 40,
  info: 20,
  warn: 30,
};

export function createLogger(
  level: LogLevel,
  stderr: NodeJS.WriteStream = process.stderr,
  baseContext: LogContext = {},
): Logger {
  const write = (currentLevel: LogLevel, message: string, context: LogContext = {}): void => {
    if (LOG_LEVEL_PRIORITY[currentLevel] < LOG_LEVEL_PRIORITY[level]) {
      return;
    }

    stderr.write(
      `${JSON.stringify({
        context: { ...baseContext, ...context },
        level: currentLevel,
        message,
        timestamp: new Date().toISOString(),
      })}\n`,
    );
  };

  return {
    child(context) {
      return createLogger(level, stderr, { ...baseContext, ...context });
    },
    debug(message, context) {
      write('debug', message, context);
    },
    error(message, context) {
      write('error', message, context);
    },
    info(message, context) {
      write('info', message, context);
    },
    warn(message, context) {
      write('warn', message, context);
    },
  };
}
