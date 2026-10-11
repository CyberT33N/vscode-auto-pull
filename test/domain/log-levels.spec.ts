import { describe, expect, it } from 'vitest';

import { shouldLog } from '../../src/domain/log-levels';

describe('shouldLog', () => {
  it('suppresses everything when configured off', () => {
    expect(shouldLog('off', 'error')).toBe(false);
  });

  it('emits at exactly the configured level', () => {
    expect(shouldLog('warn', 'warn')).toBe(true);
  });

  it('emits above the configured level', () => {
    expect(shouldLog('warn', 'error')).toBe(true);
  });

  it('suppresses below the configured level', () => {
    expect(shouldLog('warn', 'info')).toBe(false);
  });

  it('emits every level when configured debug', () => {
    expect(shouldLog('debug', 'debug')).toBe(true);
  });
});
