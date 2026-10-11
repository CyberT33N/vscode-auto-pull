/**
 * Type-only declaration surface for the built-in VS Code Git extension API
 * (`vscode.git`, API version 1).
 *
 * The declarations mirror the MIT-licensed API published by Microsoft and are
 * limited to the members this extension consumes, so the extension compiles
 * and runs without shipping any runtime dependency for Git operations.
 */

/**
 * Minimal handle on the resolved Git binary metadata.
 */
export interface GitApiGit {
  /**
   * Filesystem path of the Git executable used by the host.
   */
  readonly path: string;
}

/**
 * Upstream binding of a branch.
 */
export interface GitApiUpstreamRef {
  /**
   * Remote name of the upstream, for example `origin`.
   */
  readonly remote: string;
  /**
   * Branch name of the upstream on that remote.
   */
  readonly name: string;
}

/**
 * Branch metadata as reported by the repository state.
 */
export interface GitApiBranch {
  /**
   * Short branch name; undefined for detached HEAD states.
   */
  readonly name?: string;
  /**
   * Upstream binding when the branch tracks a remote branch.
   */
  readonly upstream?: GitApiUpstreamRef;
  /**
   * Number of local commits ahead of the upstream.
   */
  readonly ahead?: number;
  /**
   * Number of upstream commits missing locally.
   */
  readonly behind?: number;
}

/**
 * One file-level change entry inside a repository state.
 */
export interface GitApiChange {
  /**
   * Numeric status code of the change.
   */
  readonly status: number;
}

/**
 * Commit identity of an active rebase, if any.
 */
export interface GitApiCommit {
  /**
   * Object hash of the commit.
   */
  readonly hash: string;
}

/**
 * Repository state surface consumed by this extension.
 */
export interface GitApiRepositoryState {
  /**
   * Currently checked-out branch, undefined when no HEAD exists.
   */
  readonly HEAD: GitApiBranch | undefined;
  /**
   * Unfinished merge conflicts recorded in the state.
   */
  readonly mergeChanges: readonly GitApiChange[];
  /**
   * Commit of an active rebase when a rebase is in progress.
   */
  readonly rebaseCommit: GitApiCommit | undefined;
  /**
   * Staged index modifications.
   */
  readonly indexChanges: readonly GitApiChange[];
  /**
   * Tracked working-tree modifications.
   */
  readonly workingTreeChanges: readonly GitApiChange[];
  /**
   * Untracked files reported by the state.
   */
  readonly untrackedChanges: readonly GitApiChange[];
}

/**
 * Options accepted by the API fetch operation.
 */
export interface GitApiFetchOptions {
  /**
   * Remote to fetch from.
   */
  readonly remote?: string;
  /**
   * Ref to fetch on that remote.
   */
  readonly ref?: string;
}

/**
 * Repository operations consumed by this extension.
 */
export interface GitApiRepository {
  /**
   * Repository state at the time of access.
   */
  readonly state: GitApiRepositoryState;
  /**
   * Filesystem URI object of the repository root.
   */
  readonly rootUri: { readonly path: string };
  /**
   * Fetches from the remote, optionally restricted by options.
   *
   * @param options - Remote/ref restriction for the fetch.
   */
  fetch(options?: GitApiFetchOptions): Promise<void>;
  /**
   * Refreshes the repository state after a remote operation.
   */
  status(): Promise<void>;
  /**
   * Pulls the upstream branch into the working tree.
   *
   * @param unshallow - Whether to deepen a shallow repository.
   */
  pull(unshallow?: boolean): Promise<void>;
  /**
   * Rebases the current branch onto the given ref.
   *
   * @param branch - Ref the current branch is replayed onto.
   */
  rebase(branch: string): Promise<void>;
}

/**
 * API surface exposed by the built-in Git extension.
 */
export interface GitApi {
  /**
   * Resolved Git binary metadata.
   */
  readonly git: GitApiGit;
  /**
   * All repositories currently tracked by the Git extension.
   */
  readonly repositories: readonly GitApiRepository[];
}

/**
 * Extension wrapper exported by `vscode.git`.
 */
export interface GitExtensionExports {
  /**
   * Whether the Git extension is currently enabled.
   */
  readonly enabled: boolean;
  /**
   * Returns the requested API version.
   *
   * @param version - API version requested by the consumer.
   * @returns The Git API instance.
   */
  getAPI(version: 1): GitApi;
}
