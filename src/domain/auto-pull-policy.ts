/**
 * Pure decision logic for a guarded auto pull cycle.
 *
 * This module owns the safety contract of the extension: it decides whether a
 * repository may be touched at all and how an outdated branch is integrated.
 * It has no dependency on VS Code, Git, or timers, which keeps every branch
 * directly verifiable by white-box tests.
 */

/**
 * User-facing integration strategies contributed through configuration.
 */
export type AutoPullStrategy = 'ff-only' | 'rebase';

/**
 * Reasons why a repository is excluded from the current cycle.
 */
export type SkipReason =
  | 'detached-head'
  | 'no-upstream'
  | 'dirty-worktree'
  | 'merge-in-progress'
  | 'rebase-in-progress'
  | 'diverged';

/**
 * Concrete integration operation selected by the policy after the guards pass.
 */
export type IntegrationOperation = 'fast-forward' | 'rebase';

/**
 * Snapshot of the mutable working-state of one repository at cycle start.
 */
export interface WorkingStateSnapshot {
  /**
   * Name of the checked-out branch; undefined for detached HEAD states.
   */
  readonly branchName: string | undefined;
  /**
   * Whether the checked-out branch has a configured upstream reference.
   */
  readonly hasUpstream: boolean;
  /**
   * Count of tracked modifications in the index and the working tree.
   */
  readonly trackedChangeCount: number;
  /**
   * Count of untracked files reported by the repository state.
   */
  readonly untrackedChangeCount: number;
  /**
   * Whether an unfinished merge is recorded in the repository state.
   */
  readonly mergeInProgress: boolean;
  /**
   * Whether an unfinished rebase is recorded in the repository state.
   */
  readonly rebaseInProgress: boolean;
}

/**
 * Commit-distance comparison between the local branch and its upstream.
 */
export interface UpstreamComparison {
  /**
   * Number of upstream commits missing locally.
   */
  readonly behind: number;
  /**
   * Number of local commits not present on the upstream.
   */
  readonly ahead: number;
}

/**
 * Result of the policy evaluation for one repository.
 *
 * `skip` carries the blocking reason, `up-to-date` means no integration is
 * required, and `integrate` names the concrete operation to perform.
 */
export type PolicyDecision =
  | {
      /**
       * Discriminant value for a blocked repository.
       */
      readonly kind: 'skip';
      /**
       * Blocking reason selected by the guard pipeline.
       */
      readonly reason: SkipReason;
    }
  | {
      /**
       * Discriminant value for a repository already aligned with upstream.
       */
      readonly kind: 'up-to-date';
    }
  | {
      /**
       * Discriminant value for an approved integration.
       */
      readonly kind: 'integrate';
      /**
       * Concrete integration operation selected from the configured strategy.
       */
      readonly operation: IntegrationOperation;
    };

/**
 * Evaluates the guard pipeline that protects the user's working state.
 *
 * Detached heads and missing upstreams can never be pulled. Any tracked
 * modification, an unfinished merge, or an unfinished rebase blocks the cycle.
 * Untracked files block only when `includeUntrackedFiles` is disabled.
 *
 * @param snapshot - Working-state snapshot taken before the fetch.
 * @param includeUntrackedFiles - Whether untracked files are treated as non-blocking.
 * @returns The blocking skip reason, or undefined when the repository may proceed.
 */
export function findWorkingStateBlock(
  snapshot: WorkingStateSnapshot,
  includeUntrackedFiles: boolean,
): SkipReason | undefined {
  if (snapshot.branchName === undefined) {
    return 'detached-head';
  }

  if (!snapshot.hasUpstream) {
    return 'no-upstream';
  }

  if (snapshot.mergeInProgress) {
    return 'merge-in-progress';
  }

  if (snapshot.rebaseInProgress) {
    return 'rebase-in-progress';
  }

  if (snapshot.trackedChangeCount > 0) {
    return 'dirty-worktree';
  }

  if (!includeUntrackedFiles && snapshot.untrackedChangeCount > 0) {
    return 'dirty-worktree';
  }

  return undefined;
}

/**
 * Decides the integration step from the post-fetch commit comparison.
 *
 * A branch that is both ahead and behind has diverged and is never merged or
 * rebased automatically; the user resolves it manually. A branch that is only
 * behind is integrated with the configured strategy.
 *
 * @param comparison - Commit distances relative to the upstream after the fetch.
 * @param strategy - Configured integration strategy.
 * @returns The policy decision for this repository.
 */
export function decideIntegration(
  comparison: UpstreamComparison,
  strategy: AutoPullStrategy,
): PolicyDecision {
  if (comparison.behind === 0) {
    return { kind: 'up-to-date' };
  }

  if (comparison.ahead > 0) {
    return { kind: 'skip', reason: 'diverged' };
  }

  return {
    kind: 'integrate',
    operation: strategy === 'rebase' ? 'rebase' : 'fast-forward',
  };
}
