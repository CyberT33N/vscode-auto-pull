import { describe, expect, it, vi } from 'vitest';

import type { GitApiRepository } from '../../src/infrastructure/git/git-api';
import {
  createRepositoryHandle,
  createRepositoryProvider,
} from '../../src/infrastructure/git/git-repository-port';

interface RepositoryOverrides {
  head?: {
    name?: string;
    upstream?: { remote: string; name: string };
    ahead?: number;
    behind?: number;
  } | undefined;
  rootPath?: string;
  indexChanges?: number;
  workingTreeChanges?: number;
  untrackedChanges?: number;
  mergeChanges?: number;
  rebaseCommit?: { hash: string } | undefined;
}

function createFakeRepository(overrides: RepositoryOverrides = {}): GitApiRepository & {
  fetch: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
  pull: ReturnType<typeof vi.fn>;
  rebase: ReturnType<typeof vi.fn>;
} {
  return {
    rootUri: { path: overrides.rootPath ?? '/workspaces/repo-alpha' },
    state: {
      HEAD: 'head' in overrides ? overrides.head : { name: 'main', upstream: { remote: 'origin', name: 'main' } },
      mergeChanges: Array.from({ length: overrides.mergeChanges ?? 0 }, () => ({ status: 0 })),
      rebaseCommit: overrides.rebaseCommit,
      indexChanges: Array.from({ length: overrides.indexChanges ?? 0 }, () => ({ status: 0 })),
      workingTreeChanges: Array.from({ length: overrides.workingTreeChanges ?? 0 }, () => ({ status: 0 })),
      untrackedChanges: Array.from({ length: overrides.untrackedChanges ?? 0 }, () => ({ status: 0 })),
    },
    fetch: vi.fn(async () => {}),
    status: vi.fn(async () => {}),
    pull: vi.fn(async () => {}),
    rebase: vi.fn(async () => {}),
  };
}

describe('createRepositoryProvider', () => {
  it('maps all API repositories into handles', () => {
    const repository = createFakeRepository();
    const provider = createRepositoryProvider({ git: { path: '/usr/bin/git' }, repositories: [repository] });

    const handles = provider.listRepositories();

    expect(handles).toHaveLength(1);
    expect(handles[0]?.name).toBe('repo-alpha');
  });
});

describe('createRepositoryHandle', () => {
  it('derives the repository name from the root path', () => {
    expect(createRepositoryHandle(createFakeRepository()).name).toBe('repo-alpha');
  });

  it('strips trailing separators from the root path', () => {
    const handle = createRepositoryHandle(
      createFakeRepository({ rootPath: '/workspaces/repo-beta/' }),
    );

    expect(handle.name).toBe('repo-beta');
  });

  it('falls back to the trimmed path for root-only paths', () => {
    const handle = createRepositoryHandle(createFakeRepository({ rootPath: '/' }));

    expect(handle.name).toBe('');
  });

  it('snapshots a clean branch with upstream', () => {
    const snapshot = createRepositoryHandle(createFakeRepository()).snapshot();

    expect(snapshot).toEqual({
      branchName: 'main',
      hasUpstream: true,
      trackedChangeCount: 0,
      untrackedChangeCount: 0,
      mergeInProgress: false,
      rebaseInProgress: false,
    });
  });

  it('snapshots a detached head with all blocking states', () => {
    const snapshot = createRepositoryHandle(
      createFakeRepository({
        head: undefined,
        indexChanges: 1,
        workingTreeChanges: 2,
        untrackedChanges: 3,
        mergeChanges: 1,
        rebaseCommit: { hash: 'abc' },
      }),
    ).snapshot();

    expect(snapshot).toEqual({
      branchName: undefined,
      hasUpstream: false,
      trackedChangeCount: 3,
      untrackedChangeCount: 3,
      mergeInProgress: true,
      rebaseInProgress: true,
    });
  });

  it('fetches the upstream ref of the checked-out branch', async () => {
    const repository = createFakeRepository();

    await createRepositoryHandle(repository).fetchUpstream();

    expect(repository.fetch).toHaveBeenCalledWith({ remote: 'origin', ref: 'main' });
  });

  it('rejects fetches without an upstream', async () => {
    const handle = createRepositoryHandle(createFakeRepository({ head: { name: 'main' } }));

    await expect(handle.fetchUpstream()).rejects.toThrow('The checked-out branch has no upstream.');
  });

  it('reads the comparison from the refreshed HEAD', () => {
    const handle = createRepositoryHandle(
      createFakeRepository({
        head: { name: 'main', upstream: { remote: 'origin', name: 'main' }, ahead: 1, behind: 4 },
      }),
    );

    expect(handle.comparison()).toEqual({ behind: 4, ahead: 1 });
  });

  it('defaults the comparison to zero distances', () => {
    const handle = createRepositoryHandle(
      createFakeRepository({ head: { name: 'main', upstream: { remote: 'origin', name: 'main' } } }),
    );

    expect(handle.comparison()).toEqual({ behind: 0, ahead: 0 });
  });

  it('fast-forwards through the API pull', async () => {
    const repository = createFakeRepository();

    await createRepositoryHandle(repository).fastForward();

    expect(repository.pull).toHaveBeenCalledWith();
  });

  it('rebases onto the upstream ref', async () => {
    const repository = createFakeRepository();

    await createRepositoryHandle(repository).rebaseOntoUpstream();

    expect(repository.rebase).toHaveBeenCalledWith('origin/main');
  });

  it('rejects rebases without an upstream', async () => {
    const handle = createRepositoryHandle(createFakeRepository({ head: { name: 'main' } }));

    await expect(handle.rebaseOntoUpstream()).rejects.toThrow(
      'The checked-out branch has no upstream.',
    );
  });
});
