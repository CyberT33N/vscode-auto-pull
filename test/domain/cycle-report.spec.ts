import { describe, expect, it } from 'vitest';

import { formatOutcome, summarizeStatusLine } from '../../src/domain/cycle-report';
import type { CycleOutcome } from '../../src/domain/cycle-report';

describe('formatOutcome', () => {
  it('formats skipped outcomes with the reason', () => {
    expect(
      formatOutcome({ repository: 'repo-a', result: 'skipped', skipReason: 'dirty-worktree' }),
    ).toBe('repo-a: skipped (dirty-worktree)');
  });

  it('formats up-to-date outcomes', () => {
    expect(formatOutcome({ repository: 'repo-a', result: 'up-to-date' })).toBe(
      'repo-a: up to date',
    );
  });

  it('formats updated outcomes with the operation', () => {
    expect(formatOutcome({ repository: 'repo-a', result: 'updated', operation: 'rebase' })).toBe(
      'repo-a: updated via rebase',
    );
  });

  it('formats failed outcomes with the message', () => {
    expect(
      formatOutcome({ repository: 'repo-a', result: 'failed', failureMessage: 'network down' }),
    ).toBe('repo-a: failed (network down)');
  });
});

describe('summarizeStatusLine', () => {
  const failed: CycleOutcome = { repository: 'a', result: 'failed', failureMessage: 'x' };
  const updated: CycleOutcome = { repository: 'b', result: 'updated', operation: 'fast-forward' };
  const skipped: CycleOutcome = { repository: 'c', result: 'skipped', skipReason: 'no-upstream' };
  const current: CycleOutcome = { repository: 'd', result: 'up-to-date' };

  it('lets failures dominate every other class', () => {
    expect(summarizeStatusLine([updated, failed, skipped, current])).toBe(
      '$(error) Auto Pull: 1 failed',
    );
  });

  it('reports updates when nothing failed', () => {
    expect(summarizeStatusLine([updated, skipped, current])).toBe(
      '$(cloud-download) Auto Pull: 1 updated',
    );
  });

  it('reports skips when nothing was updated or failed', () => {
    expect(summarizeStatusLine([skipped, current])).toBe('$(cloud-offline) Auto Pull: 1 skipped');
  });

  it('reports the calm state for only current repositories', () => {
    expect(summarizeStatusLine([current])).toBe('$(cloud) Auto Pull: up to date');
  });
});
