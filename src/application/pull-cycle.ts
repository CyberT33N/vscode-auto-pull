/**
 * Orchestration of one guarded auto pull cycle across all repositories.
 *
 * The runner sequences the guard pipeline, the authoritative fetch, the
 * integration decision, and the integration itself. All host interaction
 * happens through injected ports, so every branch is directly testable.
 */

import {
  decideIntegration,
  findWorkingStateBlock,
} from '../domain/auto-pull-policy';
import type { CycleOutcome } from '../domain/cycle-report';
import type { RepositoryHandle, RepositoryProvider } from './ports';
import type { AutoPullSettings } from './settings';

/**
 * Collaborators required to execute one cycle.
 */
export interface CycleDependencies {
  /**
   * Provider listing the repositories to evaluate.
   */
  provider: RepositoryProvider;
  /**
   * Normalized settings governing this cycle.
   */
  settings: AutoPullSettings;
  /**
   * Callback invoked once per repository outcome for reporting.
   *
   * @param outcome - Outcome produced for one repository.
   */
  onOutcome(outcome: CycleOutcome): void;
}

/**
 * Runs one auto pull cycle over every provided repository.
 *
 * @param deps - Cycle collaborators (provider, settings, outcome sink).
 * @returns Outcomes in provider order, one per evaluated repository.
 */
export async function runPullCycle(deps: CycleDependencies): Promise<CycleOutcome[]> {
  const outcomes: CycleOutcome[] = [];

  for (const repository of deps.provider.listRepositories()) {
    const outcome = await processRepository(repository, deps.settings);
    outcomes.push(outcome);
    deps.onOutcome(outcome);
  }

  return outcomes;
}

async function processRepository(
  repository: RepositoryHandle,
  settings: AutoPullSettings,
): Promise<CycleOutcome> {
  const blockReason = findWorkingStateBlock(repository.snapshot(), settings.includeUntrackedFiles);

  if (blockReason !== undefined) {
    return { repository: repository.name, result: 'skipped', skipReason: blockReason };
  }

  try {
    await repository.fetchUpstream();
    const decision = decideIntegration(repository.comparison(), settings.strategy);

    if (decision.kind === 'up-to-date') {
      return { repository: repository.name, result: 'up-to-date' };
    }

    if (decision.kind === 'skip') {
      return { repository: repository.name, result: 'skipped', skipReason: decision.reason };
    }

    if (decision.operation === 'rebase') {
      await repository.rebaseOntoUpstream();
    } else {
      await repository.fastForward();
    }

    return { repository: repository.name, result: 'updated', operation: decision.operation };
  } catch (error) {
    return { repository: repository.name, result: 'failed', failureMessage: describeError(error) };
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
