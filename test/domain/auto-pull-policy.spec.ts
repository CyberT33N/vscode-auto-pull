import { describe, expect, it } from 'vitest';

import {
  decideIntegration,
  findWorkingStateBlock,
} from '../../src/domain/auto-pull-policy';
import type { WorkingStateSnapshot } from '../../src/domain/auto-pull-policy';

function cleanSnapshot(overrides: Partial<WorkingStateSnapshot> = {}): WorkingStateSnapshot {
  return {
    branchName: 'main',
    hasUpstream: true,
    trackedChangeCount: 0,
    untrackedChangeCount: 0,
    mergeInProgress: false,
    rebaseInProgress: false,
    ...overrides,
  };
}

describe('findWorkingStateBlock', () => {
  it('blocks detached heads', () => {
    expect(findWorkingStateBlock(cleanSnapshot({ branchName: undefined }), false)).toBe(
      'detached-head',
    );
  });

  it('blocks branches without upstream', () => {
    expect(findWorkingStateBlock(cleanSnapshot({ hasUpstream: false }), false)).toBe('no-upstream');
  });

  it('blocks unfinished merges', () => {
    expect(findWorkingStateBlock(cleanSnapshot({ mergeInProgress: true }), false)).toBe(
      'merge-in-progress',
    );
  });

  it('blocks unfinished rebases', () => {
    expect(findWorkingStateBlock(cleanSnapshot({ rebaseInProgress: true }), false)).toBe(
      'rebase-in-progress',
    );
  });

  it('blocks tracked modifications', () => {
    expect(findWorkingStateBlock(cleanSnapshot({ trackedChangeCount: 2 }), false)).toBe(
      'dirty-worktree',
    );
  });

  it('blocks untracked files by default', () => {
    expect(findWorkingStateBlock(cleanSnapshot({ untrackedChangeCount: 1 }), false)).toBe(
      'dirty-worktree',
    );
  });

  it('allows untracked files when configured', () => {
    expect(findWorkingStateBlock(cleanSnapshot({ untrackedChangeCount: 1 }), true)).toBeUndefined();
  });

  it('allows a clean branch with upstream', () => {
    expect(findWorkingStateBlock(cleanSnapshot(), false)).toBeUndefined();
  });
});

describe('decideIntegration', () => {
  it('reports up-to-date without behind commits', () => {
    expect(decideIntegration({ behind: 0, ahead: 3 }, 'ff-only')).toEqual({ kind: 'up-to-date' });
  });

  it('never auto-integrates diverged branches', () => {
    expect(decideIntegration({ behind: 2, ahead: 1 }, 'ff-only')).toEqual({
      kind: 'skip',
      reason: 'diverged',
    });
  });

  it('selects rebase for the rebase strategy', () => {
    expect(decideIntegration({ behind: 2, ahead: 0 }, 'rebase')).toEqual({
      kind: 'integrate',
      operation: 'rebase',
    });
  });

  it('selects fast-forward for the ff-only strategy', () => {
    expect(decideIntegration({ behind: 2, ahead: 0 }, 'ff-only')).toEqual({
      kind: 'integrate',
      operation: 'fast-forward',
    });
  });
});
