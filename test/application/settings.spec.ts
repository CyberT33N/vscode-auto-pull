import { describe, expect, it } from 'vitest';

import {
  DEFAULT_AUTO_PULL_SETTINGS,
  normalizeBoolean,
  normalizeIntervalSeconds,
  normalizeLogLevel,
  normalizeStrategy,
  parseSettings,
} from '../../src/application/settings';
import type { SettingsSource } from '../../src/application/settings';

function sourceWith(values: Record<string, unknown>): SettingsSource {
  return { get: (key: string): unknown => values[key] };
}

describe('normalizeBoolean', () => {
  it('keeps boolean values', () => {
    expect(normalizeBoolean(true, false)).toBe(true);
    expect(normalizeBoolean(false, true)).toBe(false);
  });

  it('falls back for non-boolean values', () => {
    expect(normalizeBoolean('yes', true)).toBe(true);
    expect(normalizeBoolean(undefined, false)).toBe(false);
  });
});

describe('normalizeIntervalSeconds', () => {
  it('falls back for non-numeric and non-finite values', () => {
    expect(normalizeIntervalSeconds('60')).toBe(60);
    expect(normalizeIntervalSeconds(Number.NaN)).toBe(60);
    expect(normalizeIntervalSeconds(undefined)).toBe(60);
  });

  it('rounds and clamps into the allowed range', () => {
    expect(normalizeIntervalSeconds(60.4)).toBe(60);
    expect(normalizeIntervalSeconds(90.6)).toBe(91);
    expect(normalizeIntervalSeconds(1)).toBe(5);
    expect(normalizeIntervalSeconds(99_999)).toBe(3600);
  });
});

describe('normalizeStrategy', () => {
  it('accepts rebase and falls back otherwise', () => {
    expect(normalizeStrategy('rebase')).toBe('rebase');
    expect(normalizeStrategy('merge')).toBe('ff-only');
    expect(normalizeStrategy(undefined)).toBe('ff-only');
  });
});

describe('normalizeLogLevel', () => {
  it('accepts every valid level', () => {
    for (const level of ['off', 'error', 'warn', 'info', 'debug'] as const) {
      expect(normalizeLogLevel(level)).toBe(level);
    }
  });

  it('falls back to info for unknown values', () => {
    expect(normalizeLogLevel('trace')).toBe('info');
    expect(normalizeLogLevel(undefined)).toBe('info');
  });
});

describe('parseSettings', () => {
  it('returns defaults for an empty source', () => {
    expect(parseSettings(sourceWith({}))).toEqual(DEFAULT_AUTO_PULL_SETTINGS);
  });

  it('normalizes a fully populated source', () => {
    const settings = parseSettings(
      sourceWith({
        enabled: false,
        intervalSeconds: 30,
        strategy: 'rebase',
        includeUntrackedFiles: true,
        showStatusBarItem: false,
        logLevel: 'debug',
      }),
    );

    expect(settings).toEqual({
      enabled: false,
      intervalSeconds: 30,
      strategy: 'rebase',
      includeUntrackedFiles: true,
      showStatusBarItem: false,
      logLevel: 'debug',
    });
  });

  it('repairs malformed values defensively', () => {
    const settings = parseSettings(
      sourceWith({
        enabled: 'yes',
        intervalSeconds: '60',
        strategy: 'merge',
        includeUntrackedFiles: 1,
        showStatusBarItem: null,
        logLevel: 'trace',
      }),
    );

    expect(settings).toEqual(DEFAULT_AUTO_PULL_SETTINGS);
  });
});
