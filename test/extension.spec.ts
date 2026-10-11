/**
 * Composition-root tests driving `activate` against the stubbed `vscode`
 * module (vitest resolve alias) and a fake built-in Git extension API.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resetVscodeStub,
  stubGetCommands,
  stubGetConfigChangeListeners,
  stubGetOutputLines,
  stubGetStatusBarItem,
  stubSetConfiguration,
  stubSetGitExtension,
} from './support/vscode-stub';
import type { StubGitApi } from './support/vscode-stub';

import { activate, deactivate, nodeTimerAdapter } from '../src/extension';
import type { TimerAdapter } from '../src/application/scheduler';

interface ActivationContextLike {
  subscriptions: { push(...items: { dispose(): void }[]): void };
  registered: { dispose(): void }[];
}

function createContext(): ActivationContextLike {
  const registered: { dispose(): void }[] = [];

  return {
    registered,
    subscriptions: {
      push(...items: { dispose(): void }[]): void {
        registered.push(...items);
      },
    },
  };
}

async function flushAsyncWork(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

interface FakeRepository {
  rootUri: { path: string };
  state: {
    HEAD: { name: string; upstream: { remote: string; name: string }; ahead: number; behind: number };
    mergeChanges: { status: number }[];
    rebaseCommit: undefined;
    indexChanges: { status: number }[];
    workingTreeChanges: { status: number }[];
    untrackedChanges: { status: number }[];
  };
  fetch: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
  pull: ReturnType<typeof vi.fn>;
  rebase: ReturnType<typeof vi.fn>;
}

function fakeRepository(name: string, behind: number, dirty: boolean): FakeRepository {
  return {
    rootUri: { path: `/workspaces/${name}` },
    state: {
      HEAD: { name: 'main', upstream: { remote: 'origin', name: 'main' }, ahead: 0, behind },
      mergeChanges: [],
      rebaseCommit: undefined,
      indexChanges: dirty ? [{ status: 0 }] : [],
      workingTreeChanges: [],
      untrackedChanges: [],
    },
    fetch: vi.fn(async () => {}),
    status: vi.fn(async () => {}),
    pull: vi.fn(async () => {}),
    rebase: vi.fn(async () => {}),
  };
}

function apiWith(repositories: readonly unknown[]): StubGitApi {
  return { git: { path: '/usr/bin/git' }, repositories: [...repositories] };
}

function defaults(overrides: Record<string, unknown> = {}): void {
  stubSetConfiguration({
    enabled: true,
    intervalSeconds: 60,
    strategy: 'ff-only',
    includeUntrackedFiles: false,
    showStatusBarItem: true,
    logLevel: 'debug',
    ...overrides,
  });
}

beforeEach(() => {
  resetVscodeStub();
});

describe('activate', () => {
  it('warns and reports the calm state when the Git extension is missing', async () => {
    defaults();
    stubSetGitExtension(undefined);

    activate(createContext());
    await flushAsyncWork();

    expect(stubGetOutputLines()).toContain(
      '[auto-pull] warn: The built-in Git extension is not available; skipping the cycle.',
    );
    expect(stubGetStatusBarItem()?.text).toBe('$(cloud) Auto Pull: up to date');
  });

  it('warns when the Git extension API cannot be created', async () => {
    defaults();
    stubSetGitExtension({
      exports: {
        getAPI() {
          throw new Error('git disabled');
        },
      },
    });

    activate(createContext());
    await flushAsyncWork();

    expect(stubGetOutputLines().some((line) => line.includes('API is unavailable'))).toBe(true);
  });
  it('warns when the Git extension has no exports surface', async () => {
    defaults();
    stubSetGitExtension({});

    activate(createContext());
    await flushAsyncWork();

    expect(stubGetOutputLines().some((line) => line.includes('no exports surface'))).toBe(true);
  });

  it('updates behind repositories and reports the result', async () => {
    defaults();
    const repository = fakeRepository('repo-a', 2, false);
    stubSetGitExtension({ exports: { getAPI: () => apiWith([repository]) } });

    activate(createContext());
    await flushAsyncWork();

    expect(vi.mocked(repository.pull)).toHaveBeenCalled();
    expect(stubGetOutputLines()).toContain('[auto-pull] info: repo-a: updated');
    expect(stubGetStatusBarItem()?.text).toBe('$(cloud-download) Auto Pull: 1 updated');
  });

  it('skips dirty repositories and logs them at debug level', async () => {
    defaults();
    stubSetGitExtension({ exports: { getAPI: () => apiWith([fakeRepository('repo-a', 2, true)]) } });

    activate(createContext());
    await flushAsyncWork();

    expect(stubGetOutputLines()).toContain('[auto-pull] debug: repo-a: skipped (dirty-worktree)');
    expect(stubGetStatusBarItem()?.text).toBe('$(cloud-offline) Auto Pull: 1 skipped');
  });

  it('records failed repositories at error level', async () => {
    defaults();
    const repository = fakeRepository('repo-a', 2, false);
    repository.fetch.mockRejectedValue(new Error('network down'));
    stubSetGitExtension({ exports: { getAPI: () => apiWith([repository]) } });

    activate(createContext());
    await flushAsyncWork();

    expect(stubGetOutputLines()).toContain('[auto-pull] error: repo-a: failed (network down)');
    expect(stubGetStatusBarItem()?.text).toBe('$(error) Auto Pull: 1 failed');
  });

  it('registers the run-now command and re-runs the cycle on demand', async () => {
    defaults();
    const repository = fakeRepository('repo-a', 0, false);
    stubSetGitExtension({ exports: { getAPI: () => apiWith([repository]) } });

    activate(createContext());
    await flushAsyncWork();

    const runNow = stubGetCommands().get('autoPull.runNow');
    expect(runNow).toBeTypeOf('function');
    await runNow?.();

    expect(stubGetOutputLines()).toContain('[auto-pull] info: repo-a: up-to-date');
  });

  it('applies configuration changes that affect autoPull only', async () => {
    defaults();
    stubSetGitExtension(undefined);
    activate(createContext());
    await flushAsyncWork();

    const listener = stubGetConfigChangeListeners()[0];
    expect(listener).toBeTypeOf('function');

    listener?.({ affectsConfiguration: () => false });
    expect(stubGetOutputLines().some((line) => line.includes('disabled'))).toBe(false);

    stubSetConfiguration({ enabled: false, logLevel: 'debug' });
    listener?.({ affectsConfiguration: (section) => section === 'autoPull' });

    expect(stubGetOutputLines()).toContain('[auto-pull] info: Auto pull is disabled.');
  });

  it('releases every registered disposable on teardown', async () => {
    defaults();
    stubSetGitExtension(undefined);
    const context = createContext();

    activate(context);
    await flushAsyncWork();

    for (const item of context.registered) {
      item.dispose();
    }

    expect(context.registered.length).toBe(5);
  });

  it('supports the hidden status bar option', async () => {
    defaults({ showStatusBarItem: false });
    stubSetGitExtension(undefined);

    activate(createContext());
    await flushAsyncWork();

    expect(stubGetStatusBarItem()?.hideCount).toBe(1);
  });

  it('runs an internal cycle when the injected timer fires', async () => {
    defaults();
    const repository = fakeRepository('repo-a', 2, false);
    stubSetGitExtension({ exports: { getAPI: () => apiWith([repository]) } });

    let tickCallback: (() => void) | undefined;
    const fakeTimer: TimerAdapter = {
      schedule(callback) {
        tickCallback = callback;

        return () => {
          tickCallback = undefined;
        };
      },
    };

    activate(createContext(), fakeTimer);
    await flushAsyncWork();

    expect(tickCallback).toBeTypeOf('function');
    expect(vi.mocked(repository.pull)).toHaveBeenCalledTimes(1);

    tickCallback?.();
    await flushAsyncWork();

    expect(vi.mocked(repository.pull)).toHaveBeenCalledTimes(2);
  });

  it('supports the node timer adapter with a real interval', () => {
    let ticks = 0;
    const cancel = nodeTimerAdapter.schedule(() => {
      ticks += 1;
    }, 1_000_000);

    cancel();

    expect(ticks).toBe(0);
  });

  it('exposes a no-op deactivate hook', () => {
    expect(deactivate()).toBeUndefined();
  });
});
