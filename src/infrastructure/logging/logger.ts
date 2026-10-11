/**
 * Level-filtered logger writing to an output-channel-like sink.
 *
 * The level threshold is provided lazily so a configuration change takes
 * effect for the next message without re-creating the logger.
 */

import { shouldLog } from '../../domain/log-levels';
import type { LogLevel } from '../../domain/log-levels';

/**
 * Minimal sink contract (satisfied by `vscode.OutputChannel`).
 */
export interface LogSink {
  /**
   * Appends one line to the sink.
   *
   * @param line - Text line to append.
   */
  appendLine(line: string): void;
}

/**
 * Prefix used on every emitted line for channel identification.
 */
export const LOGGER_PREFIX = '[auto-pull]';

/**
 * Output logger with dynamic level filtering.
 */
export class ExtensionLogger {
  /**
   * Creates the logger.
   *
   * @param sink - Destination for emitted lines.
   * @param levelProvider - Lazily reads the currently configured threshold.
   */
  constructor(
    private readonly sink: LogSink,
    private readonly levelProvider: () => LogLevel,
  ) {}

  /**
   * Emits an error-level message when the threshold allows it.
   *
   * @param message - Message text.
   */
  error(message: string): void {
    this.emit('error', message);
  }

  /**
   * Emits a warning-level message when the threshold allows it.
   *
   * @param message - Message text.
   */
  warn(message: string): void {
    this.emit('warn', message);
  }

  /**
   * Emits an info-level message when the threshold allows it.
   *
   * @param message - Message text.
   */
  info(message: string): void {
    this.emit('info', message);
  }

  /**
   * Emits a debug-level message when the threshold allows it.
   *
   * @param message - Message text.
   */
  debug(message: string): void {
    this.emit('debug', message);
  }

  private emit(level: Exclude<LogLevel, 'off'>, message: string): void {
    if (shouldLog(this.levelProvider(), level)) {
      this.sink.appendLine(`${LOGGER_PREFIX} ${level}: ${message}`);
    }
  }
}
