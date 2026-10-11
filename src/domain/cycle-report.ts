/**
 * Result model and human-readable rendering for one completed auto pull cycle.
 *
 * The types are shared by the application runner, the status-bar surface, and
 * the logger, which keeps reporting semantics in a single canonical surface.
 */

import type { IntegrationOperation, SkipReason } from './auto-pull-policy';

/**
 * Discriminant for the result class of one repository cycle.
 */
export type CycleResultKind = 'skipped' | 'up-to-date' | 'updated' | 'failed';

/**
 * Outcome of processing one repository inside a cycle.
 *
 * Discriminated by `result`: each class carries exactly the data that is
 * meaningful for it, so no defensive fallbacks are required downstream.
 */
export type CycleOutcome =
  | {
      /**
       * Display name of the repository the outcome belongs to.
       */
      readonly repository: string;
      /**
       * Result class: the repository was blocked by a guard.
       */
      readonly result: 'skipped';
      /**
       * Blocking reason selected by the guard pipeline.
       */
      readonly skipReason: SkipReason;
    }
  | {
      /**
       * Display name of the repository the outcome belongs to.
       */
      readonly repository: string;
      /**
       * Result class: the branch already matches its upstream.
       */
      readonly result: 'up-to-date';
    }
  | {
      /**
       * Display name of the repository the outcome belongs to.
       */
      readonly repository: string;
      /**
       * Result class: the upstream was integrated into the working tree.
       */
      readonly result: 'updated';
      /**
       * Integration operation that was performed.
       */
      readonly operation: IntegrationOperation;
    }
  | {
      /**
       * Display name of the repository the outcome belongs to.
       */
      readonly repository: string;
      /**
       * Result class: the cycle failed for this repository.
       */
      readonly result: 'failed';
      /**
       * Message describing the failure.
       */
      readonly failureMessage: string;
    };

/**
 * Builds one human-readable line describing a repository outcome.
 *
 * @param outcome - Outcome produced by the cycle runner.
 * @returns Single-line text suitable for tooltips and log lines.
 */
export function formatOutcome(outcome: CycleOutcome): string {
  switch (outcome.result) {
    case 'skipped':
      return `${outcome.repository}: skipped (${outcome.skipReason})`;
    case 'up-to-date':
      return `${outcome.repository}: up to date`;
    case 'updated':
      return `${outcome.repository}: updated via ${outcome.operation}`;
    case 'failed':
      return `${outcome.repository}: failed (${outcome.failureMessage})`;
  }
}

/**
 * Aggregates all outcomes into the short status-bar label.
 *
 * Failures dominate, then updates; otherwise the label reports the calm state.
 *
 * @param outcomes - All repository outcomes of one cycle.
 * @returns Codicon-prefixed status text.
 */
export function summarizeStatusLine(outcomes: readonly CycleOutcome[]): string {
  const failedCount = outcomes.filter((outcome) => outcome.result === 'failed').length;
  if (failedCount > 0) {
    return `$(error) Auto Pull: ${failedCount} failed`;
  }

  const updatedCount = outcomes.filter((outcome) => outcome.result === 'updated').length;
  if (updatedCount > 0) {
    return `$(cloud-download) Auto Pull: ${updatedCount} updated`;
  }

  const skippedCount = outcomes.filter((outcome) => outcome.result === 'skipped').length;
  if (skippedCount > 0) {
    return `$(cloud-offline) Auto Pull: ${skippedCount} skipped`;
  }

  return '$(cloud) Auto Pull: up to date';
}
