/**
 * Parsing and normalization of the `autoPull.*` configuration surface.
 *
 * Every setting is read through a minimal source contract and normalized
 * defensively, so malformed or out-of-range values can never reach the
 * guard pipeline (parse, don't validate).
 */

import type { AutoPullStrategy } from '../domain/auto-pull-policy';
import type { LogLevel } from '../domain/log-levels';

/**
 * Fully normalized configuration used by the cycle runner and scheduler.
 */
export interface AutoPullSettings {
  /**
   * Master switch for the auto pull behavior.
   */
  enabled: boolean;
  /**
   * Interval between cycles in whole seconds, clamped to the configured bounds.
   */
  intervalSeconds: number;
  /**
   * Selected integration strategy for outdated branches.
   */
  strategy: AutoPullStrategy;
  /**
   * Whether untracked files are treated as non-blocking.
   */
  includeUntrackedFiles: boolean;
  /**
   * Whether the status-bar item is displayed.
   */
  showStatusBarItem: boolean;
  /**
   * Verbosity threshold for the output channel.
   */
  logLevel: LogLevel;
}

/**
 * Minimal read surface of a VS Code workspace configuration section.
 */
export interface SettingsSource {
  /**
   * Reads one configuration key; undefined when unset.
   *
   * @param key - Key inside the `autoPull` section.
   * @returns Raw configured value or undefined.
   */
  get(key: string): unknown;
}

export const DEFAULT_AUTO_PULL_SETTINGS: AutoPullSettings = {
  enabled: true,
  intervalSeconds: 60,
  strategy: 'ff-only',
  includeUntrackedFiles: false,
  showStatusBarItem: true,
  logLevel: 'info',
};

const MIN_INTERVAL_SECONDS = 5;
const MAX_INTERVAL_SECONDS = 3600;

/**
 * Normalizes a boolean setting with a typed fallback.
 *
 * @param raw - Raw configured value.
 * @param fallback - Default used for non-boolean values.
 * @returns The boolean value or the fallback.
 */
export function normalizeBoolean(raw: unknown, fallback: boolean): boolean {
  return typeof raw === 'boolean' ? raw : fallback;
}

/**
 * Normalizes the interval setting: finite numbers only, rounded, clamped.
 *
 * @param raw - Raw configured value.
 * @returns Interval in whole seconds within the allowed bounds.
 */
export function normalizeIntervalSeconds(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_AUTO_PULL_SETTINGS.intervalSeconds;
  }

  const rounded = Math.round(raw);

  if (rounded < MIN_INTERVAL_SECONDS) {
    return MIN_INTERVAL_SECONDS;
  }

  if (rounded > MAX_INTERVAL_SECONDS) {
    return MAX_INTERVAL_SECONDS;
  }

  return rounded;
}

/**
 * Normalizes the strategy setting; unknown values fall back to `ff-only`.
 *
 * @param raw - Raw configured value.
 * @returns The validated integration strategy.
 */
export function normalizeStrategy(raw: unknown): AutoPullStrategy {
  if (raw === 'rebase') {
    return 'rebase';
  }

  return DEFAULT_AUTO_PULL_SETTINGS.strategy;
}

/**
 * Normalizes the log level; unknown values fall back to `info`.
 *
 * @param raw - Raw configured value.
 * @returns The validated log level.
 */
export function normalizeLogLevel(raw: unknown): LogLevel {
  if (raw === 'off' || raw === 'error' || raw === 'warn' || raw === 'info' || raw === 'debug') {
    return raw;
  }

  return DEFAULT_AUTO_PULL_SETTINGS.logLevel;
}

/**
 * Parses the complete `autoPull` settings surface from a configuration source.
 *
 * @param source - Read surface over the `autoPull` configuration section.
 * @returns Fully normalized settings.
 */
export function parseSettings(source: SettingsSource): AutoPullSettings {
  return {
    enabled: normalizeBoolean(source.get('enabled'), DEFAULT_AUTO_PULL_SETTINGS.enabled),
    intervalSeconds: normalizeIntervalSeconds(source.get('intervalSeconds')),
    strategy: normalizeStrategy(source.get('strategy')),
    includeUntrackedFiles: normalizeBoolean(
      source.get('includeUntrackedFiles'),
      DEFAULT_AUTO_PULL_SETTINGS.includeUntrackedFiles,
    ),
    showStatusBarItem: normalizeBoolean(
      source.get('showStatusBarItem'),
      DEFAULT_AUTO_PULL_SETTINGS.showStatusBarItem,
    ),
    logLevel: normalizeLogLevel(source.get('logLevel')),
  };
}
