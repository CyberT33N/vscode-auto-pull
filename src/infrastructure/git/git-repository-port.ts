/**
 * Adapter mapping the built-in Git extension API onto application ports.
 *
 * This module is the only place that touches the `vscode.git` object model;
 * it performs no decisions itself — the guard pipeline and the integration
 * strategy remain in the domain and application layers.
 */

import type { RepositoryHandle, RepositoryProvider } from '../../application/ports';
import type { GitApi, GitApiRepository } from './git-api';

/**
 * Builds a repository provider over the repositories tracked by the Git API.
 *
 * @param api - Git extension API instance (version 1).
 * @returns Provider returning one handle per tracked repository.
 */
export function createRepositoryProvider(api: GitApi): RepositoryProvider {
  return {
    listRepositories: () => api.repositories.map(createRepositoryHandle),
  };
}

/**
 * Wraps one Git API repository into the application port.
 *
 * @param repository - Repository from the Git extension API.
 * @returns Handle exposing snapshot, fetch, comparison, and integration operations.
 */
export function createRepositoryHandle(repository: GitApiRepository): RepositoryHandle {
  return {
    name: repositoryName(repository),
    snapshot: () => ({
      branchName: repository.state.HEAD?.name,
      hasUpstream: repository.state.HEAD?.upstream !== undefined,
      trackedChangeCount:
        repository.state.indexChanges.length + repository.state.workingTreeChanges.length,
      untrackedChangeCount: repository.state.untrackedChanges.length,
      mergeInProgress: repository.state.mergeChanges.length > 0,
      rebaseInProgress: repository.state.rebaseCommit !== undefined,
    }),
    fetchUpstream: async () => {
      const upstream = repository.state.HEAD?.upstream;

      if (upstream === undefined) {
        throw new Error('The checked-out branch has no upstream.');
      }

      await repository.fetch({ remote: upstream.remote, ref: upstream.name });
    },
    comparison: () => ({
      behind: repository.state.HEAD?.behind ?? 0,
      ahead: repository.state.HEAD?.ahead ?? 0,
    }),
    fastForward: async () => {
      await repository.pull();
    },
    rebaseOntoUpstream: async () => {
      const upstream = repository.state.HEAD?.upstream;

      if (upstream === undefined) {
        throw new Error('The checked-out branch has no upstream.');
      }

      await repository.rebase(`${upstream.remote}/${upstream.name}`);
    },
  };
}

function repositoryName(repository: GitApiRepository): string {
  const trimmed = repository.rootUri.path.replace(/\/+$/, '');
  const segments = trimmed.split('/').filter((segment) => segment.length > 0);
  const last = segments.at(-1);

  if (last === undefined) {
    return trimmed;
  }

  return last;
}
