import { describe, expect, it } from 'vitest';

import { ExtensionLogger } from '../../src/infrastructure/logging/logger';
import type { LogSink } from '../../src/infrastructure/logging/logger';
import type { LogLevel } from '../../src/domain/log-levels';

function createSink(): { sink: LogSink; lines: string[] } {
  const lines: string[] = [];

  return {
    lines,
    sink: {
      appendLine: (line: string) => {
        lines.push(line);
      },
    },
  };
}

function createLogger(level: LogLevel): { logger: ExtensionLogger; lines: string[] } {
  const { sink, lines } = createSink();

  return { lines, logger: new ExtensionLogger(sink, () => level) };
}

describe('ExtensionLogger', () => {
  it('emits error lines with the channel prefix', () => {
    const { logger, lines } = createLogger('error');

    logger.error('boom');
    logger.warn('noise');

    expect(lines).toEqual(['[auto-pull] error: boom']);
  });

  it('emits warn lines at warn level', () => {
    const { logger, lines } = createLogger('warn');

    logger.warn('careful');

    expect(lines).toEqual(['[auto-pull] warn: careful']);
  });

  it('emits info lines at info level', () => {
    const { logger, lines } = createLogger('info');

    logger.info('hello');

    expect(lines).toEqual(['[auto-pull] info: hello']);
  });

  it('emits debug lines at debug level', () => {
    const { logger, lines } = createLogger('debug');

    logger.debug('detail');

    expect(lines).toEqual(['[auto-pull] debug: detail']);
  });

  it('emits nothing when disabled', () => {
    const { logger, lines } = createLogger('off');

    logger.error('hidden');
    logger.warn('hidden');
    logger.info('hidden');
    logger.debug('hidden');

    expect(lines).toEqual([]);
  });
});
