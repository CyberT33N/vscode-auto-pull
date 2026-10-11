/**
 * Extension entry point wiring the auto pull composition root.
 *
 * Responsibilities are limited to host integration: reading the Git API,
 * building the settings source, creating the output channel and status item,
 * and driving the scheduler. All decision logic lives in the domain and
 * application layers. The interval primitive is injected through the typed
 * `TimerAdapter` port so the whole wiring is verifiable without global stubs.
 */

import * as vscode from 'vscode';

import { runPullCycle } from './application/pull-cycle';
import type { RepositoryProvider } from './application/ports';
import { AutoPullScheduler } from './application/scheduler';
import type { TimerAdapter } from './application/scheduler';
import { parseSettings } from './application/settings';
import type { AutoPullSettings } from './application/settings';
import type { CycleOutcome } from './domain/cycle-report';
import type { GitApi, GitExtensionExports } from './infrastructure/git/git-api';
import { createRepositoryProvider } from './infrastructure/git/git-repository-port';
import { ExtensionLogger } from './infrastructure/logging/logger';
import { AutoPullStatusPresenter } from './infrastructure/ui/status-bar';

const CONFIGURATION_SECTION = 'autoPull';
const GIT_EXTENSION_ID = 'vscode.git';

/**
 * Minimal disposable contract accepted by the activation context.
 */
export interface DisposableLike {
  /**
   * Releases the resource represented by this disposable.
   */
  dispose(): void;
}

/**
 * Minimal extension-context contract consumed by `activate`.
 *
 * It is structurally satisfied by the real `vscode.ExtensionContext` while
 * keeping the composition root testable without host fakes of unrelated
 * context members.
 */
export interface ActivationContext {
  /**
   * Collection the extension registers its disposables in.
   */
  readonly subscriptions: {
    /**
     * Registers disposables for release at deactivation.
     *
     * @param items - Disposables to register.
     */
    push(...items: DisposableLike[]): unknown;
  };
}

/**
 * Interval port backed by the Node.js timer primitives of the extension host.
 */
export const nodeTimerAdapter: TimerAdapter = {
  schedule(callback, intervalMs) {
    const handle = setInterval(callback, intervalMs);

    return () => {
      clearInterval(handle);
    };
  },
};

/**
 * Activates the extension and starts the first cycle plus the interval loop.
 *
 * @param context - VS Code extension context owning the disposable lifecycle.
 * @param timer - Interval port; defaults to the Node.js timer implementation.
 */
export function activate(
  context: ActivationContext,
  timer: TimerAdapter = nodeTimerAdapter,
): void {
  const outputChannel = vscode.window.createOutputChannel('Auto Pull [Secured]');
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  const logger = new ExtensionLogger(outputChannel, () => readSettings().logLevel);
  const presenter = new AutoPullStatusPresenter(statusBar);
  const scheduler = new AutoPullScheduler(timer, async () => {
    await executeCycle(presenter, logger);
  });

  context.subscriptions.push(
    outputChannel,
    statusBar,
    {
      dispose: () => {
        scheduler.stop();
      },
    },
    vscode.commands.registerCommand('autoPull.runNow', async () => {
      await executeCycle(presenter, logger);
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration(CONFIGURATION_SECTION)) {
        return;
      }

      applySettings(scheduler, readSettings(), logger);
    }),
  );

  applySettings(scheduler, readSettings(), logger);
  void executeCycle(presenter, logger);
}

/**
 * Deactivation hook; disposables are released through the extension context.
 */
export function deactivate(): void {}

function readSettings(): AutoPullSettings {
  return parseSettings(vscode.workspace.getConfiguration(CONFIGURATION_SECTION));
}

function applySettings(
  scheduler: AutoPullScheduler,
  settings: AutoPullSettings,
  logger: ExtensionLogger,
): void {
  if (!settings.enabled) {
    scheduler.stop();
    logger.info('Auto pull is disabled.');

    return;
  }

  scheduler.start(settings.intervalSeconds * 1000);
  logger.debug(`Auto pull cycle scheduled every ${settings.intervalSeconds}s.`);
}

async function executeCycle(
  presenter: AutoPullStatusPresenter,
  logger: ExtensionLogger,
): Promise<void> {
  const settings = readSettings();
  const provider = resolveRepositoryProvider(logger);
  const outcomes = await runPullCycle({
    provider,
    settings,
    onOutcome: (outcome) => logOutcome(logger, outcome),
  });

  presenter.present(outcomes, settings.showStatusBarItem);
}

function resolveRepositoryProvider(logger: ExtensionLogger): RepositoryProvider {
  const emptyProvider: RepositoryProvider = { listRepositories: () => [] };
  const gitExtension = vscode.extensions.getExtension<GitExtensionExports>(GIT_EXTENSION_ID);

  if (gitExtension === undefined) {
    logger.warn('The built-in Git extension is not available; skipping the cycle.');

    return emptyProvider;
  }

  const exports = gitExtension.exports;

  if (exports === undefined) {
    logger.warn('The built-in Git extension has no exports surface; skipping the cycle.');

    return emptyProvider;
  }

  let api: GitApi;

  try {
    api = exports.getAPI(1);
  } catch (error) {
    logger.warn(
      `The built-in Git extension API is unavailable (${String(error)}); skipping the cycle.`,
    );

    return emptyProvider;
  }

  return createRepositoryProvider(api);
}

function logOutcome(logger: ExtensionLogger, outcome: CycleOutcome): void {
  const message = `${outcome.repository}: ${outcome.result}`;

  if (outcome.result === 'failed') {
    logger.error(`${message} (${outcome.failureMessage})`);

    return;
  }

  if (outcome.result === 'skipped') {
    logger.debug(`${message} (${outcome.skipReason})`);

    return;
  }

  logger.info(message);
}
