/**
 * Application-layer ports consumed by the pull-cycle runner.
 *
 * The infrastructure adapters implement these interfaces; the runner and the
 * domain policy depend only on these contracts, which keeps every decision
 * path fakeable in white-box tests without a VS Code or Git host.
 */

import type { UpstreamComparison, WorkingStateSnapshot } from '../domain/auto-pull-policy';

/**
 * One repository the auto pull cycle may evaluate and integrate.
 */
export interface RepositoryHandle {
  /**
   * Display name of the repository, used in outcomes and reports.
   */
  readonly name: string;
  /**
   * Reads the current working-state snapshot without mutating anything.
   *
   * @returns Snapshot used by the guard pipeline.
   */
  snapshot(): WorkingStateSnapshot;
  /**
   * Fetches the upstream ref of the checked-out branch.
   *
   * @returns Resolves when the fetch completed; rejects on Git or network failure.
   */
  fetchUpstream(): Promise<void>;
  /**
   * Reads the commit distances relative to the upstream after the fetch.
   *
   * @returns Ahead/behind comparison used by the integration decision.
   */
  comparison(): UpstreamComparison;
  /**
   * Integrates the upstream by fast-forwarding the checked-out branch.
   *
   * @returns Resolves when the working tree is updated.
   */
  fastForward(): Promise<void>;
  /**
   * Integrates the upstream by rebasing local commits onto it.
   *
   * @returns Resolves when the rebase completed.
   */
  rebaseOntoUpstream(): Promise<void>;
}

/**
 * Provides the repositories the current workspace should auto-pull.
 */
export interface RepositoryProvider {
  /**
   * Lists all repositories eligible for evaluation in this cycle.
   *
   * @returns Repository handles; empty when no Git provider is available.
   */
  listRepositories(): readonly RepositoryHandle[];
}
