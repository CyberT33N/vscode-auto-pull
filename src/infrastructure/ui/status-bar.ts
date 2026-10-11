/**
 * Status-bar presentation of the latest auto pull cycle.
 */

import type { StatusBarItem } from 'vscode';

import { formatOutcome, summarizeStatusLine } from '../../domain/cycle-report';
import type { CycleOutcome } from '../../domain/cycle-report';

/**
 * Status-bar item surface consumed by the presenter.
 *
 * It is the exact structural subset of the host type, so the real
 * `vscode.StatusBarItem` is accepted without an adapter and without any
 * duplicated surface that could drift from the host contract.
 */
export type StatusBarTarget = Pick<StatusBarItem, 'text' | 'tooltip' | 'show' | 'hide'>;

/**
 * Renders cycle outcomes into a single status-bar item.
 */
export class AutoPullStatusPresenter {
  /**
   * Creates the presenter.
   *
   * @param item - Status-bar item to drive.
   */
  constructor(private readonly item: StatusBarTarget) {}

  /**
   * Presents the latest cycle result or hides the item when disabled.
   *
   * @param outcomes - Outcomes of the most recent cycle.
   * @param visible - Value of the `autoPull.showStatusBarItem` setting.
   */
  present(outcomes: readonly CycleOutcome[], visible: boolean): void {
    if (!visible) {
      this.item.hide();
      return;
    }

    this.item.text = summarizeStatusLine(outcomes);
    this.item.tooltip = outcomes.map(formatOutcome).join('\n');
    this.item.show();
  }
}
