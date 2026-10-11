/**
 * Log-level model shared by the configuration surface and the logger adapter.
 */

/**
 * Configurable verbosity levels for the extension output channel.
 */
export type LogLevel = 'off' | 'error' | 'warn' | 'info' | 'debug';

const LEVEL_RANK: Readonly<Record<Exclude<LogLevel, 'off'>, number>> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

/**
 * Decides whether a message of the given level passes the configured threshold.
 *
 * @param configured - Threshold selected by the user settings.
 * @param messageLevel - Level of the message about to be emitted.
 * @returns True when the message must be emitted.
 */
export function shouldLog(configured: LogLevel, messageLevel: Exclude<LogLevel, 'off'>): boolean {
  if (configured === 'off') {
    return false;
  }

  return LEVEL_RANK[messageLevel] <= LEVEL_RANK[configured];
}
