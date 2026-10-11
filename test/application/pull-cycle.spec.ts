import { describe, expect, it } from 'vitest';

import { runPullCycle } from '../../src/application/pull-cycle';
import type { CycleDependencies } from '../../src/application/pull-cycle';
import type { RepositoryHandle, RepositoryProvider } from '../../src/application/ports';
import type { AutoPullSettings } from '../../src/application/settings';
import { DEFAULT_AUTO_PULL_SETTINGS } from '../../src/application/settings';
import type { UpstreamComparison, WorkingStateSnapshot } from '../../src/domain/auto-pull-policy';
import type { CycleOutcome } from '../../src/domain/cycle-report';

interface FakeRepositoryOptions {
  snapshot?: Partial<WorkingStateSnapshot>;
  comparison?: UpstreamComparison;
  fetchError?: unknown;
}

function createFakeRepository(
  name: string,
  options: FakeRepositoryOptions = {},
): { handle: RepositoryHandle; calls: string[] } {
  const calls: string[] = [];
  const snapshot: WorkingStateSnapshot = {
    branchName: 'main',
    hasUpstream: true,
    trackedChangeCount: 0,
    untrackedChangeCount: 0,
    mergeInProgress: false,
    rebaseInProgress: false,
    ...options.snapshot,
  };

  return {
    calls,
    handle: {
      name,
      snapshot: () => snapshot,
      fetchUpstream: async () => {
        calls.push('fetch');
        if (options.fetchError !== undefined) {
          throw options.fetchError;
        }
      },
      comparison: () => options.comparison ?? { behind: 0, ahead: 0 },
      fastForward: async () => {
        calls.push('fast-forward');
      },
      rebaseOntoUpstream: async () => {
        calls.push('rebase');
      },
    },
  };
}

function createDeps(
  repositories: readonly RepositoryHandle[],
  settings: Partial<AutoPullSettings> = {},
): { deps: CycleDependencies; outcomes: CycleOutcome[] } {
  const provider: RepositoryProvider = { listRepositories: () => repositories };
  const outcomes: CycleOutcome[] = [];

  return {
    outcomes,
    deps: {
      provider,
      settings: { ...DEFAULT_AUTO_PULL_SETTINGS, ...settings },
      onOutcome: (outcome) => {
        outcomes.push(outcome);
      },
    },
  };
}

describe('runPullCycle', () => {
  it('returns an empty list without repositories', async () => {
    const { deps, outcomes } = createDeps([]);

    expect(await runPullCycle(deps)).toEqual([]);
    expect(outcomes).toEqual([]);
  });

  it('skips blocked repositories without fetching', async () => {
    const fake = createFakeRepository('repo-a', { snapshot: { trackedChangeCount: 1 } });
    const { deps } = createDeps([fake.handle]);

    const results = await runPullCycle(deps);

    expect(results).toEqual([{ repository: 'repo-a', result: 'skipped', skipReason: 'dirty-worktree' }]);
    expect(fake.calls).toEqual([]);
  });

  it('reports up-to-date after a fetch without behind commits', async () => {
    const fake = createFakeRepository('repo-a', { comparison: { behind: 0, ahead: 2 } });
    const { deps } = createDeps([fake.handle]);

    expect(await runPullCycle(deps)).toEqual([
      { repository: 'repo-a', result: 'up-to-date' },
    ]);
    expect(fake.calls).toEqual(['fetch']);
  });

  it('fast-forwards behind branches with the default strategy', async () => {
    const fake = createFakeRepository('repo-a', { comparison: { behind: 2, ahead: 0 } });
    const { deps } = createDeps([fake.handle]);

    expect(await runPullCycle(deps)).toEqual([
      { repository: 'repo-a', result: 'updated', operation: 'fast-forward' },
    ]);
    expect(fake.calls).toEqual(['fetch', 'fast-forward']);
  });

  it('rebases behind branches with the rebase strategy', async () => {
    const fake = createFakeRepository('repo-a', { comparison: { behind: 2, ahead: 0 } });
    const { deps } = createDeps([fake.handle], { strategy: 'rebase' });

    expect(await runPullCycle(deps)).toEqual([
      { repository: 'repo-a', result: 'updated', operation: 'rebase' },
    ]);
    expect(fake.calls).toEqual(['fetch', 'rebase']);
  });

  it('skips diverged branches after the fetch', async () => {
    const fake = createFakeRepository('repo-a', { comparison: { behind: 2, ahead: 1 } });
    const { deps } = createDeps([fake.handle]);

    expect(await runPullCycle(deps)).toEqual([
      { repository: 'repo-a', result: 'skipped', skipReason: 'diverged' },
    ]);
    expect(fake.calls).toEqual(['fetch']);
  });

  it('records failed cycles with the error message', async () => {
    const fake = createFakeRepository('repo-a', { fetchError: new Error('network down') });
    const { deps } = createDeps([fake.handle]);

    expect(await runPullCycle(deps)).toEqual([
      { repository: 'repo-a', result: 'failed', failureMessage: 'network down' },
    ]);
  });

  it('stringifies non-error throwables', async () => {
    const fake = createFakeRepository('repo-a', { fetchError: 'boom' });
    const { deps } = createDeps([fake.handle]);

    expect(await runPullCycle(deps)).toEqual([
      { repository: 'repo-a', result: 'failed', failureMessage: 'boom' },
    ]);
  });

  it('processes every repository in provider order and reports each outcome', async () => {
    const first = createFakeRepository('repo-a');
    const second = createFakeRepository('repo-b', { snapshot: { hasUpstream: false } });
    const { deps, outcomes } = createDeps([first.handle, second.handle]);

    const results = await runPullCycle(deps);

    expect(results.map((outcome) => outcome.repository)).toEqual(['repo-a', 'repo-b']);
    expect(outcomes).toEqual(results);
  });
});
